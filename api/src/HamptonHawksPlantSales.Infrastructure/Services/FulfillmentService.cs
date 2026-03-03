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

    public FulfillmentService(AppDbContext db, IAdminService adminService)
    {
        _db = db;
        _adminService = adminService;
    }

    public async Task<ScanResponse> ScanAsync(Guid orderId, string barcode)
    {
        const int maxAttempts = 3;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await ScanInternalAsync(orderId, barcode);
            }
            catch (DbUpdateConcurrencyException) when (attempt < maxAttempts)
            {
                _db.ChangeTracker.Clear();
            }
            catch (DbUpdateException ex) when (attempt < maxAttempts && IsRetryableConcurrencyException(ex))
            {
                _db.ChangeTracker.Clear();
            }
        }

        // Final attempt without catch filter so unexpected errors still bubble up.
        try
        {
            return await ScanInternalAsync(orderId, barcode);
        }
        catch (DbUpdateConcurrencyException)
        {
            await CreateEvent(orderId, null, barcode.Trim(), FulfillmentResult.AlreadyFulfilled,
                BuildActionMessage("Another station updated this order at the same time.", "Wait a moment, then scan again.", "Concurrent scan conflict."));

            return new ScanResponse
            {
                Result = FulfillmentResult.AlreadyFulfilled,
                OrderId = orderId,
                OrderRemainingItems = await GetOrderRemainingItems(orderId)
            };
        }
        catch (DbUpdateException ex) when (IsRetryableConcurrencyException(ex))
        {
            await CreateEvent(orderId, null, barcode.Trim(), FulfillmentResult.AlreadyFulfilled,
                BuildActionMessage("Another station updated this order at the same time.", "Wait a moment, then scan again.", "Concurrent scan conflict."));

            return new ScanResponse
            {
                Result = FulfillmentResult.AlreadyFulfilled,
                OrderId = orderId,
                OrderRemainingItems = await GetOrderRemainingItems(orderId)
            };
        }
    }

    private async Task<ScanResponse> ScanInternalAsync(Guid orderId, string barcode)
    {
        // 1. Check SaleClosed
        if (await _adminService.IsSaleClosedAsync())
        {
            await CreateEvent(orderId, null, barcode, FulfillmentResult.SaleClosedBlocked, BuildActionMessage("Sales are currently closed.", "Ask an admin to reopen sales or try again when sales are open."));
            return new ScanResponse
            {
                Result = FulfillmentResult.SaleClosedBlocked,
                OrderId = orderId,
                OrderRemainingItems = 0
            };
        }

        // 2. Normalize barcode
        barcode = barcode.Trim();

        // 3. Lookup PlantCatalog by Barcode — use AsNoTracking so EF does not cache this entity.
        //    This prevents the identity map from returning a stale version inside the transaction.
        var plant = await _db.PlantCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Barcode == barcode && p.DeletedAt == null);

        if (plant == null)
        {
            await CreateEvent(orderId, null, barcode, FulfillmentResult.NotFound, BuildActionMessage("The scanned barcode is not in the catalog.", "Rescan the label or ask an admin to add the item."));
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
            await CreateEvent(orderId, plant.Id, barcode, FulfillmentResult.WrongOrder,
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
            if (isRelational)
            {
                // Acquire exclusive lock on the inventory row before loading it as a tracked entity.
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    plant.Id);

                // Acquire exclusive lock on the order line row before loading it as a tracked entity.
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"OrderId\" = {0} AND \"PlantCatalogId\" = {1} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    orderId, plant.Id);
            }

            // Load tracked entities — these will be fresh from DB since no cached version exists.
            var lockedInventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plant.Id && i.DeletedAt == null);

            var lockedOrderLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null);

            if (lockedInventory == null || lockedOrderLine == null)
            {
                if (transaction != null) await transaction.RollbackAsync();
                await CreateEvent(orderId, plant.Id, barcode, FulfillmentResult.OutOfStock, BuildActionMessage("This item could not be reserved for fulfillment.", "Refresh the order and try scanning again.", "Inventory or order row missing during lock."));
                return BuildScanResponse(FulfillmentResult.OutOfStock, orderId, plant, orderLineCheck);
            }

            // Re-check conditions after acquiring locks — values are fresh from the locked DB rows.
            if (lockedOrderLine.QtyFulfilled >= lockedOrderLine.QtyOrdered)
            {
                if (transaction != null) await transaction.RollbackAsync();
                await CreateEvent(orderId, plant.Id, barcode, FulfillmentResult.AlreadyFulfilled,
                    BuildActionMessage("This line is already fully fulfilled.", "Move to the next item or use Undo if the prior scan was incorrect."));
                return BuildScanResponse(FulfillmentResult.AlreadyFulfilled, orderId, plant, lockedOrderLine);
            }

            if (lockedInventory.OnHandQty <= 0)
            {
                if (transaction != null) await transaction.RollbackAsync();
                await CreateEvent(orderId, plant.Id, barcode, FulfillmentResult.OutOfStock,
                    BuildActionMessage("This item is out of stock.", "Set it aside and ask an admin to adjust inventory or choose a substitute."));
                return BuildScanResponse(FulfillmentResult.OutOfStock, orderId, plant, lockedOrderLine);
            }

            // Decrement inventory, increment fulfilled
            lockedInventory.OnHandQty -= 1;
            lockedOrderLine.QtyFulfilled += 1;

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

            // Insert FulfillmentEvent(Accepted)
            var evt = new FulfillmentEvent
            {
                OrderId = orderId,
                PlantCatalogId = plant.Id,
                Barcode = barcode,
                Result = FulfillmentResult.Accepted,
                Message = $"Scanned 1x '{plant.Name}'. Fulfilled {lockedOrderLine.QtyFulfilled}/{lockedOrderLine.QtyOrdered}."
            };
            _db.FulfillmentEvents.Add(evt);

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            // Calculate remaining items across all lines
            var remaining = await GetOrderRemainingItems(orderId);

            await _adminService.LogActionAsync("UndoLastScan", "Order", orderId, reason,
                $"Operator: {operatorName}. Undo applied to barcode {lastAccepted.Barcode}.");

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
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }
    }

    private static bool IsRetryableConcurrencyException(DbUpdateException exception)
    {
        var message = exception.InnerException?.Message ?? exception.Message;
        return message.Contains("could not serialize access", StringComparison.OrdinalIgnoreCase)
            || message.Contains("deadlock detected", StringComparison.OrdinalIgnoreCase)
            || message.Contains("concurrent update", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<ScanResponse> UndoLastScanAsync(Guid orderId, string reason, string operatorName)
    {
        // Check SaleClosed
        if (await _adminService.IsSaleClosedAsync())
        {
            await CreateEvent(orderId, null, string.Empty, FulfillmentResult.SaleClosedBlocked, BuildActionMessage("Sales are currently closed.", "Ask an admin to reopen sales or try again when sales are open."));
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
                // Acquire lock on inventory row
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} FOR UPDATE",
                    lastAccepted.PlantCatalogId);

                // Acquire lock on order line row
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"OrderId\" = {0} AND \"PlantCatalogId\" = {1} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    orderId, lastAccepted.PlantCatalogId);

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
                if (transaction != null) await transaction.RollbackAsync();
                throw new KeyNotFoundException("Order line or inventory not found for undo.");
            }

            // Decrement fulfilled, increment inventory
            orderLine.QtyFulfilled = Math.Max(0, orderLine.QtyFulfilled - 1);
            inventory.OnHandQty += 1;

            // Soft-delete the accepted event
            eventToUndo.DeletedAt = DateTimeOffset.UtcNow;

            // Create undo event
            var plant = await _db.PlantCatalogs.FindAsync(lastAccepted.PlantCatalogId);
            var undoEvent = new FulfillmentEvent
            {
                OrderId = orderId,
                PlantCatalogId = lastAccepted.PlantCatalogId,
                Barcode = lastAccepted.Barcode,
                Result = FulfillmentResult.Accepted,
                Message = $"UNDO: Reversed scan of '{plant?.Name ?? "unknown"}'. Fulfilled {orderLine.QtyFulfilled}/{orderLine.QtyOrdered}."
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
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> CompleteOrderAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

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
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();
    }

    private async Task<FulfillmentEvent> CreateEvent(Guid orderId, Guid? plantCatalogId, string barcode,
        FulfillmentResult result, string? message)
    {
        var evt = new FulfillmentEvent
        {
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
