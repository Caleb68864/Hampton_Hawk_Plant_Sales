using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class FulfillmentService : IFulfillmentService
{
    private readonly AppDbContext _db;
    private readonly IAdminService _adminService;
    private readonly ICurrentUser? _currentUser;

    public FulfillmentService(AppDbContext db, IAdminService adminService, ICurrentUser? currentUser = null)
    {
        _db = db;
        _adminService = adminService;
        _currentUser = currentUser;
    }

    public async Task<ScanResponse> ScanAsync(Guid orderId, string barcode, int quantity = 1, string? scanId = null)
    {
        // Multi-quantity scanning (volunteer "set N, scan once" workflow):
        // coerce non-positive values to 1 so a malformed client cannot zero-out
        // a scan. The internal path caps at the line's remaining quantity.
        if (quantity <= 0) quantity = 1;

        var normalizedScanId = string.IsNullOrWhiteSpace(scanId) ? null : scanId.Trim();

        // Replay check before any work: a resubmission of a scan we already applied
        // returns the original outcome rather than fulfilling another unit.
        if (normalizedScanId != null)
        {
            var replay = await TryReplayScanAsync(orderId, normalizedScanId);
            if (replay != null) return replay;
        }

        // Scans contend on the same inventory/order-line rows whenever two stations
        // pick the same plant. Under Serializable the conflict surfaces as a raw
        // PostgresException (40001/40P01) at SELECT ... FOR UPDATE, not as a
        // DbUpdateException, so the retry has to inspect SqlState on any exception.
        try
        {
            return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () =>
                ScanInternalAsync(orderId, barcode, quantity, normalizedScanId));
        }
        catch (Exception ex) when (WalkUpRowLocks.IsRetryableConcurrencyFailure(ex))
        {
            // Retry budget exhausted: tell the volunteer to rescan rather than 500.
            _db.ChangeTracker.Clear();
            await CreateEvent(FulfillmentEventSource.PickupScan, orderId, null, barcode.Trim(), FulfillmentResult.AlreadyFulfilled,
                BuildActionMessage("Another station updated this order at the same time.", "Wait a moment, then scan again.", "Concurrent scan conflict."));

            return new ScanResponse
            {
                Result = FulfillmentResult.AlreadyFulfilled,
                OrderId = orderId,
                OrderRemainingItems = await GetOrderRemainingItems(orderId)
            };
        }
    }

    /// <summary>
    /// Returns the outcome of an already-applied scan with this id, or null if this id
    /// has not been seen on this order. Reports the line's current state rather than a
    /// snapshot, so the client's view stays truthful even if later scans have landed.
    /// </summary>
    private async Task<ScanResponse?> TryReplayScanAsync(Guid orderId, string scanId)
    {
        var priorEvent = await _db.FulfillmentEvents
            .AsNoTracking()
            .Where(e => e.OrderId == orderId && e.IdempotencyKey == scanId && e.DeletedAt == null)
            .FirstOrDefaultAsync();

        if (priorEvent == null) return null;

        var plant = priorEvent.PlantCatalogId.HasValue
            ? await _db.PlantCatalogs.AsNoTracking().FirstOrDefaultAsync(p => p.Id == priorEvent.PlantCatalogId.Value)
            : null;

        var line = priorEvent.PlantCatalogId.HasValue
            ? await _db.OrderLines.AsNoTracking().FirstOrDefaultAsync(l =>
                l.OrderId == orderId && l.PlantCatalogId == priorEvent.PlantCatalogId.Value && l.DeletedAt == null)
            : null;

        return new ScanResponse
        {
            Result = priorEvent.Result,
            OrderId = orderId,
            Plant = plant == null ? null : new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
            Line = line == null ? null : new ScanLineInfo
            {
                QtyOrdered = line.QtyOrdered,
                QtyFulfilled = line.QtyFulfilled,
                QtyRemaining = line.QtyOrdered - line.QtyFulfilled
            },
            OrderRemainingItems = await GetOrderRemainingItems(orderId)
        };
    }

    private async Task<ScanResponse> ScanInternalAsync(Guid orderId, string barcode, int quantity, string? scanId = null)
    {
        // 0. The order must exist, not be deleted, and be Open/InProgress.
        await EnsureOrderAcceptsFulfillmentAsync(orderId);

        // 1. Check SaleClosed
        if (await _adminService.IsSaleClosedAsync())
        {
            await CreateEvent(FulfillmentEventSource.PickupScan, orderId, null, barcode, FulfillmentResult.SaleClosedBlocked, BuildActionMessage("Sales are currently closed.", "Ask an admin to reopen sales or try again when sales are open."));
            return new ScanResponse
            {
                Result = FulfillmentResult.SaleClosedBlocked,
                OrderId = orderId,
                OrderRemainingItems = 0
            };
        }

        // 2. Normalize scan input (scanner barcode or manually typed SKU)
        barcode = barcode.Trim();

        // 3. Lookup PlantCatalog by Barcode OR SKU — use AsNoTracking so EF does not cache this entity.
        //    This prevents the identity map from returning a stale version inside the transaction.
        var plant = await _db.PlantCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(p => (p.Barcode == barcode || p.Sku == barcode) && p.DeletedAt == null);

        if (plant == null)
        {
            await CreateEvent(FulfillmentEventSource.PickupScan, orderId, null, barcode, FulfillmentResult.NotFound, BuildActionMessage("The scanned barcode/SKU is not in the catalog.", "Rescan the label, or verify the SKU and ask an admin to add/fix the item."));
            return new ScanResponse
            {
                Result = FulfillmentResult.NotFound,
                OrderId = orderId,
                OrderRemainingItems = 0
            };
        }

        // 4. Find OrderLine for orderId + PlantCatalogId — AsNoTracking for the same reason.
        var orderLineCheck = await _db.OrderLines
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null);

        if (orderLineCheck == null)
        {
            await CreateEvent(FulfillmentEventSource.PickupScan, orderId, plant.Id, barcode, FulfillmentResult.WrongOrder,
                BuildActionMessage("This scanned item does not belong to the selected order.",
                    "Confirm the order number or add the item to the order before rescanning.",
                    $"Plant '{plant.Name}' is not on order {orderId}."));
            return new ScanResponse
            {
                Result = FulfillmentResult.WrongOrder,
                OrderId = orderId,
                Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                OrderRemainingItems = 0
            };
        }

        // 5. Transaction with FOR UPDATE row locks and serializable isolation for relational providers.
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Plant, inventory, then the order line: the canonical order in WalkUpRowLocks.
            // The plant lock matters even though the plant row is rarely written here: the
            // event insert below takes FOR KEY SHARE on it, and a register holds it.
            await WalkUpRowLocks.AcquireAsync(_db, plant.Id, orderId);

            // The order row last (canonical order), then its status again: it was
            // checked before the transaction, and a bulk cancel that committed since
            // must win over this scan.
            await WalkUpRowLocks.LockOrdersAsync(_db, new[] { orderId });
            await EnsureOrderAcceptsFulfillmentAsync(orderId);

            // Load tracked entities — these will be fresh from DB since no cached version exists.
            var lockedInventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plant.Id && i.DeletedAt == null);

            var lockedOrderLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null);

            if (lockedInventory == null || lockedOrderLine == null)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                await CreateEvent(FulfillmentEventSource.PickupScan, orderId, plant.Id, barcode, FulfillmentResult.OutOfStock, BuildActionMessage("This item could not be reserved for fulfillment.", "Refresh the order and try scanning again.", "Inventory or order row missing during lock."));
                return BuildScanResponse(FulfillmentResult.OutOfStock, orderId, plant, orderLineCheck);
            }

            // Re-check the replay guard under the locks: two retries of the same scan can
            // both clear the pre-transaction check, and only one may apply.
            if (scanId != null)
            {
                var alreadyApplied = await _db.FulfillmentEvents
                    .AsNoTracking()
                    .AnyAsync(e => e.OrderId == orderId && e.IdempotencyKey == scanId && e.DeletedAt == null);

                if (alreadyApplied)
                {
                    await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                    return await TryReplayScanAsync(orderId, scanId)
                        ?? BuildScanResponse(FulfillmentResult.Accepted, orderId, plant, lockedOrderLine);
                }
            }

            // Re-check conditions after acquiring locks — values are fresh from the locked DB rows.
            if (lockedOrderLine.QtyFulfilled >= lockedOrderLine.QtyOrdered)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                await CreateEvent(FulfillmentEventSource.PickupScan, orderId, plant.Id, barcode, FulfillmentResult.AlreadyFulfilled,
                    BuildActionMessage("This line is already fully fulfilled.", "Move to the next item or use Undo if the prior scan was incorrect."));
                return BuildScanResponse(FulfillmentResult.AlreadyFulfilled, orderId, plant, lockedOrderLine);
            }

            if (lockedInventory.OnHandQty <= 0)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                await CreateEvent(FulfillmentEventSource.PickupScan, orderId, plant.Id, barcode, FulfillmentResult.OutOfStock,
                    BuildActionMessage("This item is out of stock.", "Set it aside and ask an admin to adjust inventory or choose a substitute."));
                return BuildScanResponse(FulfillmentResult.OutOfStock, orderId, plant, lockedOrderLine);
            }

            // Multi-quantity scan: apply min(requested, line-remaining, inventory-on-hand).
            // Capping at line-remaining prevents over-fulfillment of the line; capping at
            // inventory-on-hand keeps the inventory non-negative when the volunteer
            // requests more than is physically in stock. The response is still
            // Accepted with the actual count (the volunteer asked for a quantity,
            // not "as many as possible" — they need to know exactly how many landed).
            var lineRemaining = lockedOrderLine.QtyOrdered - lockedOrderLine.QtyFulfilled;
            var applied = Math.Min(quantity, Math.Min(lineRemaining, lockedInventory.OnHandQty));
            if (applied <= 0) applied = 1; // defensive — earlier guards already caught zero/negative cases

            lockedInventory.OnHandQty -= applied;
            lockedOrderLine.QtyFulfilled += applied;

            // Set BarcodeLockedAt if null — plant was loaded AsNoTracking, so load tracked version
            var trackedPlant = await _db.PlantCatalogs.FindAsync(plant.Id);
            if (trackedPlant != null && trackedPlant.BarcodeLockedAt == null)
            {
                trackedPlant.BarcodeLockedAt = DateTimeOffset.UtcNow;
            }

            // Update order status to InProgress if Open
            var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order != null && order.Status == OrderStatus.Open)
            {
                order.Status = OrderStatus.InProgress;
            }

            // Insert FulfillmentEvent(Accepted) — single event with Quantity column
            // captures the volunteer intent cleanly (one scan = one event), while
            // Quantity preserves the audit count without N rows of noise.
            var evt = new FulfillmentEvent
            {
                UserId = _currentUser?.UserId,
                Source = FulfillmentEventSource.PickupScan,
                OrderId = orderId,
                PlantCatalogId = plant.Id,
                Barcode = barcode,
                Result = FulfillmentResult.Accepted,
                Quantity = applied,
                IdempotencyKey = scanId,
                Message = $"Scanned {applied}x '{plant.Name}'. Fulfilled {lockedOrderLine.QtyFulfilled}/{lockedOrderLine.QtyOrdered}."
            };
            _db.FulfillmentEvents.Add(evt);

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            // Calculate remaining items across all lines
            var remaining = await GetOrderRemainingItems(orderId);


            return new ScanResponse
            {
                Result = FulfillmentResult.Accepted,
                OrderId = orderId,
                Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                Line = new ScanLineInfo
                {
                    QtyOrdered = lockedOrderLine.QtyOrdered,
                    QtyFulfilled = lockedOrderLine.QtyFulfilled,
                    QtyRemaining = lockedOrderLine.QtyOrdered - lockedOrderLine.QtyFulfilled
                },
                OrderRemainingItems = remaining
            };
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }


    public async Task<ScanResponse> ManualFulfillAsync(Guid orderId, ManualFulfillRequest request)
    {
        if (request.OrderLineId == Guid.Empty)
            throw new ValidationException("Order line is required.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ValidationException("Reason is required for manual fulfillment.");

        if (string.IsNullOrWhiteSpace(request.OperatorName))
            throw new ValidationException("Operator name is required for manual fulfillment.");

        await EnsureOrderAcceptsFulfillmentAsync(orderId);

        // Replay: a manual fulfil resent after a timeout fulfilled one more unit.
        var requestId = string.IsNullOrWhiteSpace(request.RequestId) ? null : request.RequestId.Trim();
        if (requestId != null)
        {
            var replay = await TryReplayScanAsync(orderId, requestId);
            if (replay != null) return replay;
        }

        if (await _adminService.IsSaleClosedAsync())
        {
            await CreateEvent(FulfillmentEventSource.ManualFulfill, orderId, null, "MANUAL", FulfillmentResult.SaleClosedBlocked,
                BuildActionMessage("Sales are currently closed.", "Ask an admin to reopen sales or try again when sales are open."));
            return new ScanResponse
            {
                Result = FulfillmentResult.SaleClosedBlocked,
                OrderId = orderId,
                OrderRemainingItems = 0
            };
        }

        // Serializable conflicts with a scan or a bulk status change are routine;
        // retry them instead of surfacing the abort (it used to reach the desk as a 500).
        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () => ManualFulfillLockedAsync(orderId, request, requestId));
    }

    private async Task<ScanResponse> ManualFulfillLockedAsync(Guid orderId, ManualFulfillRequest request, string? requestId)
    {
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Canonical order (WalkUpRowLocks): plant and inventory before the line. The
            // plant is only known from the line, so read it unlocked, lock, then re-read
            // under the lock and make sure it did not move to another plant meanwhile.
            var plantCatalogId = await _db.OrderLines
                .AsNoTracking()
                .Where(l => l.Id == request.OrderLineId && l.DeletedAt == null)
                .Select(l => (Guid?)l.PlantCatalogId)
                .FirstOrDefaultAsync()
                ?? throw new KeyNotFoundException("Order line not found.");

            await WalkUpRowLocks.LockPlantAsync(_db, plantCatalogId);
            await WalkUpRowLocks.LockOrderLinesAsync(_db, new[] { request.OrderLineId });

            var line = await _db.OrderLines
                .Include(l => l.PlantCatalog)
                .FirstOrDefaultAsync(l => l.Id == request.OrderLineId && l.DeletedAt == null)
                ?? throw new KeyNotFoundException("Order line not found.");

            if (line.OrderId != orderId)
                throw new ValidationException("Order line does not belong to this order.");

            if (line.PlantCatalogId != plantCatalogId)
                throw new ValidationException("This order line was changed while it was being fulfilled. Refresh the order and try again.");

            // Order row last, then its status again (checked before the transaction).
            await WalkUpRowLocks.LockOrdersAsync(_db, new[] { orderId });
            await EnsureOrderAcceptsFulfillmentAsync(orderId);

            // Again under the line lock: two copies of one request can both pass the
            // check above, and only one may apply.
            if (requestId != null && await _db.FulfillmentEvents.AsNoTracking()
                    .AnyAsync(e => e.OrderId == orderId && e.IdempotencyKey == requestId && e.DeletedAt == null))
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                return (await TryReplayScanAsync(orderId, requestId))!;
            }

            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == line.PlantCatalogId && i.DeletedAt == null)
                ?? throw new KeyNotFoundException("Inventory record not found.");

            if (line.QtyFulfilled >= line.QtyOrdered)
                throw new ValidationException("This line is already fully fulfilled.");

            if (inventory.OnHandQty <= 0)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                await CreateEvent(FulfillmentEventSource.ManualFulfill, orderId, line.PlantCatalogId, "MANUAL", FulfillmentResult.OutOfStock,
                    BuildActionMessage("This item is out of stock.", "Set it aside and ask an admin to adjust inventory or choose a substitute."));
                return new ScanResponse
                {
                    Result = FulfillmentResult.OutOfStock,
                    OrderId = orderId,
                    Plant = new ScanPlantInfo { Sku = line.PlantCatalog.Sku, Name = line.PlantCatalog.Name },
                    Line = new ScanLineInfo
                    {
                        QtyOrdered = line.QtyOrdered,
                        QtyFulfilled = line.QtyFulfilled,
                        QtyRemaining = line.QtyOrdered - line.QtyFulfilled
                    },
                    OrderRemainingItems = await GetOrderRemainingItems(orderId)
                };
            }

            inventory.OnHandQty -= 1;
            line.QtyFulfilled += 1;

            var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null);
            if (order != null && order.Status == OrderStatus.Open)
                order.Status = OrderStatus.InProgress;

            var evt = new FulfillmentEvent
            {
                UserId = _currentUser?.UserId,
                Source = FulfillmentEventSource.ManualFulfill,
                OrderId = orderId,
                PlantCatalogId = line.PlantCatalogId,
                Barcode = "MANUAL",
                Result = FulfillmentResult.Accepted,
                IdempotencyKey = requestId,
                Message = $"MANUAL FULFILL: {request.OperatorName} fulfilled 1x '{line.PlantCatalog.Name}'. Reason: {request.Reason}. Fulfilled {line.QtyFulfilled}/{line.QtyOrdered}."
            };
            _db.FulfillmentEvents.Add(evt);

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            await _adminService.LogActionAsync(
                "ManualFulfill",
                "Order",
                orderId,
                request.Reason,
                $"Operator: {request.OperatorName}. OrderLineId: {request.OrderLineId}.");

            return new ScanResponse
            {
                Result = FulfillmentResult.Accepted,
                OrderId = orderId,
                Plant = new ScanPlantInfo { Sku = line.PlantCatalog.Sku, Name = line.PlantCatalog.Name },
                Line = new ScanLineInfo
                {
                    QtyOrdered = line.QtyOrdered,
                    QtyFulfilled = line.QtyFulfilled,
                    QtyRemaining = line.QtyOrdered - line.QtyFulfilled
                },
                OrderRemainingItems = await GetOrderRemainingItems(orderId)
            };
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    public async Task<ScanResponse> UndoLastScanAsync(Guid orderId, string reason, string operatorName)
    {
        // Check SaleClosed
        if (await _adminService.IsSaleClosedAsync())
        {
            await CreateEvent(FulfillmentEventSource.Undo, orderId, null, string.Empty, FulfillmentResult.SaleClosedBlocked, BuildActionMessage("Sales are currently closed.", "Ask an admin to reopen sales or try again when sales are open."));
            return new ScanResponse
            {
                Result = FulfillmentResult.SaleClosedBlocked,
                OrderId = orderId,
                OrderRemainingItems = 0
            };
        }

        // Find most recent Accepted event for this order — AsNoTracking to avoid stale cache
        var lastAccepted = await _db.FulfillmentEvents
            .AsNoTracking()
            .Where(e => e.OrderId == orderId && e.Result == FulfillmentResult.Accepted && e.DeletedAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();

        if (lastAccepted == null)
            throw new KeyNotFoundException("No accepted scan found to undo.");

        if (lastAccepted.PlantCatalogId == null)
            throw new InvalidOperationException("Cannot undo event without a plant reference.");

        var isRelationalUndo = _db.Database.IsRelational();
        var transaction = isRelationalUndo ? await _db.Database.BeginTransactionAsync() : null;
        try
        {
            if (isRelationalUndo)
            {
                // Plant, inventory, order line, then the event: the canonical order in
                // WalkUpRowLocks. The undo event's insert takes FOR KEY SHARE on the plant.
                await WalkUpRowLocks.AcquireAsync(_db, lastAccepted.PlantCatalogId.Value, orderId);

                // Acquire lock on the fulfillment event row
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"FulfillmentEvents\" WHERE \"Id\" = {0} FOR UPDATE",
                    lastAccepted.Id);
            }

            // Load tracked entities fresh from DB
            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == lastAccepted.PlantCatalogId);

            var orderLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == lastAccepted.PlantCatalogId && l.DeletedAt == null);

            var eventToUndo = await _db.FulfillmentEvents
                .FirstOrDefaultAsync(e => e.Id == lastAccepted.Id);

            if (orderLine == null || inventory == null || eventToUndo == null)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new KeyNotFoundException("Order line or inventory not found for undo.");
            }

            // Reverse the whole event, not a single unit: a multi-quantity scan is one
            // event with Quantity = N, and it is retired below in full. Clamp to what
            // the line actually holds so undo can never drive QtyFulfilled negative or
            // restore more stock than the scan took.
            var reversed = Math.Min(Math.Max(1, eventToUndo.Quantity), orderLine.QtyFulfilled);
            orderLine.QtyFulfilled -= reversed;
            inventory.OnHandQty += reversed;

            // Soft-delete the accepted event
            eventToUndo.DeletedAt = DateTimeOffset.UtcNow;

            // Create undo event
            var plant = await _db.PlantCatalogs.FindAsync(lastAccepted.PlantCatalogId);
            var undoEvent = new FulfillmentEvent
            {
                UserId = _currentUser?.UserId,
                Source = FulfillmentEventSource.Undo,
                OrderId = orderId,
                PlantCatalogId = lastAccepted.PlantCatalogId,
                Barcode = lastAccepted.Barcode,
                Result = FulfillmentResult.Undone,
                Quantity = reversed,
                Message = $"UNDO: Reversed scan of {reversed}x '{plant?.Name ?? "unknown"}'. Fulfilled {orderLine.QtyFulfilled}/{orderLine.QtyOrdered}."
            };
            _db.FulfillmentEvents.Add(undoEvent);

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            var remaining = await GetOrderRemainingItems(orderId);

            await _adminService.LogActionAsync("UndoLastScan", "Order", orderId, reason,
                $"Operator: {operatorName}. Undo applied to barcode {lastAccepted.Barcode}.");

            return new ScanResponse
            {
                Result = FulfillmentResult.Accepted,
                OrderId = orderId,
                Plant = plant != null ? new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name } : null,
                Line = new ScanLineInfo
                {
                    QtyOrdered = orderLine.QtyOrdered,
                    QtyFulfilled = orderLine.QtyFulfilled,
                    QtyRemaining = orderLine.QtyOrdered - orderLine.QtyFulfilled
                },
                OrderRemainingItems = remaining
            };
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    public async Task<bool> CompleteOrderAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.Status == OrderStatus.Cancelled || order.Status == OrderStatus.Draft)
            throw new ValidationException($"Cannot complete order: order is {order.Status}.");

        if (order.OrderLines.Count == 0)
            throw new ValidationException("Cannot complete order: order has no lines.");

        var allFulfilled = order.OrderLines.All(l => l.QtyFulfilled >= l.QtyOrdered);
        if (!allFulfilled)
            throw new ValidationException("Cannot complete order: not all lines are fully fulfilled.");

        order.Status = OrderStatus.Complete;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ForceCompleteOrderAsync(Guid orderId, string reason, string operatorName)
    {
        var order = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

        order.Status = OrderStatus.Complete;
        await _db.SaveChangesAsync();

        await _adminService.LogActionAsync("ForceComplete", "Order", orderId, reason,
            $"Operator: {operatorName}. Order force-completed with unfulfilled lines.");

        return true;
    }

    public async Task<bool> ResetOrderAsync(Guid orderId, string reason, string operatorName)
    {
        var order = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

        if (order.Status != OrderStatus.Complete)
            throw new ValidationException("Only completed orders can be reset.");

        order.Status = OrderStatus.InProgress;
        await _db.SaveChangesAsync();

        await _adminService.LogActionAsync("ResetOrder", "Order", orderId, reason,
            $"Operator: {operatorName}. Order reset from Complete to InProgress.");

        return true;
    }

    public async Task<List<FulfillmentEventResponse>> GetEventsAsync(Guid orderId)
    {
        return await _db.FulfillmentEvents
            .Where(e => e.OrderId == orderId && e.DeletedAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new FulfillmentEventResponse
            {
                Id = e.Id,
                OrderId = e.OrderId,
                PlantCatalogId = e.PlantCatalogId,
                Barcode = e.Barcode,
                Result = e.Result,
                Message = e.Message,
                UserId = e.UserId,
                Source = e.Source,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();
    }

    /// <summary>
    /// Only Open and InProgress orders may take stock. A cancelled order's barcode is
    /// still scannable at the table, and without this check it decremented inventory
    /// for an order nobody is picking up.
    /// </summary>
    private async Task EnsureOrderAcceptsFulfillmentAsync(Guid orderId)
    {
        var order = await _db.Orders
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Status, o.DeletedAt })
            .FirstOrDefaultAsync();

        // Checked before any event is written: an event for an order id that
        // does not exist fails its FK and used to surface as a 500.
        if (order == null)
            throw new KeyNotFoundException("Order not found.");

        // A deleted order's lines are not soft-deleted with it, so without this
        // a station still showing the order could scan it and take stock.
        if (order.DeletedAt != null)
            throw new ValidationException("This order was deleted and cannot be fulfilled. Reload the order list.");

        if (order.Status != OrderStatus.Open && order.Status != OrderStatus.InProgress)
            throw new ValidationException($"Order is {order.Status} and cannot be fulfilled.");
    }

    private async Task<FulfillmentEvent> CreateEvent(FulfillmentEventSource source, Guid orderId, Guid? plantCatalogId, string barcode,
        FulfillmentResult result, string? message)
    {
        var evt = new FulfillmentEvent
        {
            UserId = _currentUser?.UserId,
            Source = source,
            OrderId = orderId,
            PlantCatalogId = plantCatalogId,
            Barcode = barcode,
            Result = result,
            Message = message
        };
        _db.FulfillmentEvents.Add(evt);
        await _db.SaveChangesAsync();
        return evt;
    }


    private static string BuildActionMessage(string whatHappened, string whatToDoNext, string? details = null)
    {
        var message = $"What happened: {whatHappened} What to do next: {whatToDoNext}";
        return string.IsNullOrWhiteSpace(details)
            ? message
            : $"{message} Technical details: {details}";
    }

    private ScanResponse BuildScanResponse(FulfillmentResult result, Guid orderId, PlantCatalog plant, OrderLine line)
    {
        return new ScanResponse
        {
            Result = result,
            OrderId = orderId,
            Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
            Line = new ScanLineInfo
            {
                QtyOrdered = line.QtyOrdered,
                QtyFulfilled = line.QtyFulfilled,
                QtyRemaining = line.QtyOrdered - line.QtyFulfilled
            },
            OrderRemainingItems = 0
        };
    }

    private async Task<int> GetOrderRemainingItems(Guid orderId)
    {
        return await _db.OrderLines
            .Where(l => l.OrderId == orderId && l.DeletedAt == null)
            .SumAsync(l => l.QtyOrdered - l.QtyFulfilled);
    }
}
