using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class WalkUpRegisterService : IWalkUpRegisterService
{
    private readonly AppDbContext _db;
    private readonly IInventoryProtectionService _protection;
    private readonly IAdminService _adminService;
    private readonly IConfiguration _configuration;

    public WalkUpRegisterService(
        AppDbContext db,
        IInventoryProtectionService protection,
        IAdminService adminService,
        IConfiguration configuration)
    {
        _db = db;
        _protection = protection;
        _adminService = adminService;
        _configuration = configuration;
    }

    public async Task<OrderResponse> CreateDraftAsync(CreateDraftRequest request)
    {
        // Two registers can allocate the same number in the same instant; the unique
        // index rejects the loser, and re-probing gets it the next free number.
        const int maxAttempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            var order = new Order
            {
                CustomerId = null,
                OrderNumber = await WalkUpOrderNumbers.NextAsync(_db),
                IsWalkUp = true,
                Status = OrderStatus.Draft
            };

            _db.Orders.Add(order);
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (attempt < maxAttempts && WalkUpOrderNumbers.IsUniqueViolation(ex))
            {
                _db.Entry(order).State = EntityState.Detached;
                continue;
            }

            return await GetOrderResponseAsync(order.Id);
        }
    }

    public async Task<OrderResponse> ScanIntoDraftAsync(
        Guid orderId,
        ScanIntoDraftRequest request,
        string? adminPin = null,
        string? adminReason = null)
    {
        if (string.IsNullOrWhiteSpace(request.PlantBarcode))
            throw new ValidationException("PlantBarcode is required.");
        if (string.IsNullOrWhiteSpace(request.ScanId))
            throw new ValidationException("ScanId is required.");

        var barcode = request.PlantBarcode.Trim();
        var scanId = request.ScanId.Trim();

        // Manager override: the register line carries no barcode, so the client
        // cannot find the line to adjust. It re-sends the refused scan with the
        // PIN instead, and the override applies here, under the same locks.
        var isOverride = TryAdminOverride(adminPin, adminReason);

        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        // Registers contend on the same plant row constantly during a busy sale, so
        // serialization conflicts are routine. Retry them: the scanId keeps a retry
        // from double-selling, and a volunteer must never be shown a database abort.
        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () =>
            ScanIntoDraftInternalAsync(orderId, barcode, scanId, request.Quantity, isOverride, adminReason));
    }

    private async Task<OrderResponse> ScanIntoDraftInternalAsync(
        Guid orderId, string barcode, string scanId, int requestedQuantity, bool isOverride, string? adminReason)
    {
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Find plant by barcode/sku — lookup before lock so we can lock by plantId
            var plant = await _db.PlantCatalogs
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    (p.Barcode == barcode || p.Sku == barcode) && p.DeletedAt == null);

            if (plant == null)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new ValidationException($"No plant found for barcode '{barcode}'.");
            }

            // Plant, inventory, then the existing line if any, then the draft's order
            // row (canonical order, WalkUpRowLocks). Cancel and close lock the same
            // order row, so a scan cannot commit into a draft they have finished.
            await WalkUpRowLocks.AcquireAsync(_db, plant.Id, orderId);
            await WalkUpRowLocks.LockOrdersAsync(_db, new[] { orderId });

            // Idempotency: any scan id already applied to this draft is a replay, not a
            // second sale -- including a delayed retry of an older scan that arrives
            // after newer ones, or one whose line has since been voided. Checked under
            // the plant lock, so two retries of one scan cannot both pass.
            var existingLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null);

            // The line's last-scan key is checked too: it is the only record a draft
            // opened before WalkUpRegisterScans existed has of its scans.
            var isReplay = existingLine?.LastScanIdempotencyKey == scanId
                || await _db.WalkUpRegisterScans.AnyAsync(s => s.OrderId == orderId && s.ScanId == scanId);
            if (isReplay)
            {
                if (transaction != null) await transaction.CommitAsync();
                return await GetOrderResponseAsync(orderId);
            }

            // The draft was checked before the transaction; check it again under the
            // order lock. A cancel or close that committed meanwhile wins.
            var stillDraft = await _db.Orders.AsNoTracking().AnyAsync(o =>
                o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft);
            if (!stillDraft)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new KeyNotFoundException("Draft order not found. It was closed or cancelled at another station.");
            }

            // Multi-quantity scanning: coerce non-positive to 1 so the API stays
            // backward compatible for callers that omit/send 0.
            var requestedAdd = requestedQuantity <= 0 ? 1 : requestedQuantity;

            // Validate only the units being added. The register already took this
            // line's earlier units out of OnHandQty at scan time, so availability
            // reflects them; checking the cumulative total would count them twice
            // and refuse the sale once the line reached half the stock.
            var (allowed, available, errorMessage) = await _protection.ValidateWalkupLineAsync(plant.Id, requestedAdd, orderId);
            if (!allowed && !isOverride)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new ValidationException(errorMessage ?? "Walk-up availability exceeded.");
            }

            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plant.Id && i.DeletedAt == null);

            if (inventory == null || inventory.OnHandQty <= 0)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new ValidationException($"Plant '{plant.Name}' is out of stock.");
            }

            // Cap the additive amount at remaining on-hand inventory. Walk-up
            // availability has already been validated (or overridden) above for
            // the units being added, so on-hand is the remaining ceiling. An
            // override never lets OnHandQty go negative.
            var appliedAdd = Math.Min(requestedAdd, inventory.OnHandQty);
            if (appliedAdd <= 0)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new ValidationException($"Plant '{plant.Name}' is out of stock.");
            }

            inventory.OnHandQty -= appliedAdd;

            if (existingLine == null)
            {
                var newLine = new OrderLine
                {
                    OrderId = orderId,
                    PlantCatalogId = plant.Id,
                    QtyOrdered = appliedAdd,
                    QtyFulfilled = appliedAdd,
                    LastScanIdempotencyKey = scanId
                };
                _db.OrderLines.Add(newLine);
            }
            else
            {
                existingLine.QtyOrdered += appliedAdd;
                existingLine.QtyFulfilled += appliedAdd;
                existingLine.LastScanIdempotencyKey = scanId;
            }

            _db.WalkUpRegisterScans.Add(new WalkUpRegisterScan
            {
                OrderId = orderId,
                ScanId = scanId,
                PlantCatalogId = plant.Id,
                Quantity = appliedAdd
            });

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            // Logged only when the override was what let the scan through.
            if (isOverride && !allowed)
            {
                var lineId = existingLine?.Id
                    ?? (await _db.OrderLines.FirstAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null)).Id;
                await _adminService.LogActionAsync(
                    "WalkUpRegisterScanOverride",
                    "OrderLine",
                    lineId,
                    adminReason!,
                    $"Added {appliedAdd} of plant {plant.Id} past walk-up availability (override).");
            }

            return await GetOrderResponseAsync(orderId);
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    public async Task<OrderResponse> AdjustLineAsync(
        Guid orderId,
        Guid lineId,
        AdjustLineRequest request,
        string? adminPin = null,
        string? adminReason = null)
    {
        if (request.NewQty < 0)
            throw new ValidationException("NewQty must be zero or greater.");

        // An override is only an override when the PIN checks out. A bare
        // X-Admin-Reason header must not bypass availability.
        var isOverride = TryAdminOverride(adminPin, adminReason);

        // Same contention as scanning: retry serialization conflicts rather than
        // surfacing a database abort to the volunteer.
        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () =>
            AdjustLineInternalAsync(orderId, lineId, request, isOverride, adminReason));
    }

    private async Task<OrderResponse> AdjustLineInternalAsync(
        Guid orderId, Guid lineId, AdjustLineRequest request, bool isOverride, string? adminReason)
    {
        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Plant and inventory before the line (canonical order, WalkUpRowLocks). The
            // line's plant is checked against the request below, under the locks.
            await WalkUpRowLocks.LockPlantAsync(_db, request.PlantCatalogId);
            await WalkUpRowLocks.LockOrderLinesAsync(_db, new[] { lineId });

            var line = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
                ?? throw new KeyNotFoundException("Order line not found.");

            if (line.PlantCatalogId != request.PlantCatalogId)
                throw new ValidationException("Plant catalog id does not match the line.");

            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == line.PlantCatalogId && i.DeletedAt == null)
                ?? throw new KeyNotFoundException("Inventory record not found.");

            var diff = request.NewQty - line.QtyFulfilled;

            if (diff == 0)
            {
                if (transaction != null) await transaction.CommitAsync();
                return await GetOrderResponseAsync(orderId);
            }

            if (diff < 0)
            {
                // Reducing quantity — restore inventory by abs(diff)
                inventory.OnHandQty += -diff;
                line.QtyOrdered = request.NewQty;
                line.QtyFulfilled = request.NewQty;
            }
            else
            {
                // Increasing quantity — validate the increment, not the new total:
                // the line's current units already left OnHandQty at scan time.
                var (allowed, _, errorMessage) = await _protection.ValidateWalkupLineAsync(line.PlantCatalogId, diff, orderId);

                if (!allowed && !isOverride)
                {
                    await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                    throw new ValidationException(errorMessage ?? "Walk-up availability exceeded; admin override required.");
                }

                // The override lets an admin sell into preorder commitments; it never
                // lets OnHandQty go negative -- the register takes the units at scan
                // time, and there are no units to take.
                if (inventory.OnHandQty < diff)
                {
                    await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                    throw new ValidationException("Insufficient inventory to increase line quantity.");
                }

                inventory.OnHandQty -= diff;
                line.QtyOrdered = request.NewQty;
                line.QtyFulfilled = request.NewQty;

                if (isOverride)
                {
                    await _adminService.LogActionAsync(
                        "WalkUpRegisterAdjustOverride",
                        "OrderLine",
                        lineId,
                        adminReason!,
                        $"Adjusted line to {request.NewQty} (override).");
                }
            }

            if (line.QtyFulfilled == 0)
            {
                line.DeletedAt = DateTimeOffset.UtcNow;
            }

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            return await GetOrderResponseAsync(orderId);
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    /// <summary>
    /// Mirrors <c>WalkUpService.TryAdminOverride</c>: no PIN means no override, a
    /// wrong PIN is rejected outright, and a valid PIN needs a reason for the audit log.
    /// </summary>
    private bool TryAdminOverride(string? pin, string? reason)
    {
        if (string.IsNullOrWhiteSpace(pin))
            return false;

        var expectedPin = Environment.GetEnvironmentVariable("APP_ADMIN_PIN")
            ?? _configuration["AdminPin"]
            ?? string.Empty;

        if (expectedPin.Length == 0 || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(pin),
                System.Text.Encoding.UTF8.GetBytes(expectedPin)))
            throw new ValidationException("Invalid admin PIN.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ValidationException("Admin reason is required for override.");

        return true;
    }

    public async Task<OrderResponse> VoidLineAsync(Guid orderId, Guid lineId, string adminReason)
    {
        if (string.IsNullOrWhiteSpace(adminReason))
            throw new ValidationException("Admin reason is required for void line.");

        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () =>
            VoidLineInternalAsync(orderId, lineId, adminReason));
    }

    private async Task<OrderResponse> VoidLineInternalAsync(Guid orderId, Guid lineId, string adminReason)
    {
        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Plant and inventory before the line (canonical order, WalkUpRowLocks). The
            // plant is only known from the line: read it unlocked, lock, re-read, and
            // check it did not move.
            var plantCatalogId = await _db.OrderLines
                .AsNoTracking()
                .Where(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
                .Select(l => (Guid?)l.PlantCatalogId)
                .FirstOrDefaultAsync()
                ?? throw new KeyNotFoundException("Order line not found.");

            await WalkUpRowLocks.LockPlantAsync(_db, plantCatalogId);
            await WalkUpRowLocks.LockOrderLinesAsync(_db, new[] { lineId });

            var line = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
                ?? throw new KeyNotFoundException("Order line not found.");

            if (line.PlantCatalogId != plantCatalogId)
                throw new ValidationException("This line was changed while it was being voided. Refresh and try again.");

            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == line.PlantCatalogId && i.DeletedAt == null);

            if (inventory != null)
            {
                inventory.OnHandQty += line.QtyFulfilled;
            }

            line.DeletedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            await _adminService.LogActionAsync(
                "WalkUpRegisterVoidLine",
                "OrderLine",
                lineId,
                adminReason,
                $"Voided line on draft {orderId}; restored {line.QtyFulfilled} units to inventory for plant {line.PlantCatalogId}.");

            return await GetOrderResponseAsync(orderId);
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    private static readonly string[] KnownPaymentMethods = { "Cash", "Card", "Check", "Other" };

    // Orders.AmountTendered is numeric(12,2): anything at or above 10^10 overflowed
    // in Postgres (22003) and came back as a 500.
    private const decimal MaxAmountTendered = 99_999_999.99m;

    public async Task<OrderResponse> CloseDraftAsync(Guid orderId, CloseDraftRequest request)
    {
        if (request.AmountTendered is < 0m)
            throw new ValidationException("Amount tendered must be zero or greater.");
        if (request.AmountTendered is > MaxAmountTendered)
            throw new ValidationException("Amount tendered is too large.");

        // "cash" and "Cash" were stored as given and split the payment report.
        var method = string.IsNullOrWhiteSpace(request.PaymentMethod) ? null : request.PaymentMethod.Trim();
        if (method != null)
            method = KnownPaymentMethods.FirstOrDefault(m => string.Equals(m, method, StringComparison.OrdinalIgnoreCase)) ?? method;
        var normalized = new CloseDraftRequest { PaymentMethod = method, AmountTendered = request.AmountTendered };

        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () => CloseDraftInternalAsync(orderId, normalized));
    }

    private async Task<OrderResponse> CloseDraftInternalAsync(Guid orderId, CloseDraftRequest request)
    {
        // Under the draft's order lock, the lock every register scan takes before it
        // writes: a scan in flight either commits before the close reads the lines
        // (and is paid for) or is refused after it. Unlocked, a scan could land on
        // the Complete order after payment was taken.
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            await WalkUpRowLocks.LockOrdersAsync(_db, new[] { orderId });

            var draft = await _db.Orders
                .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft);
            if (draft == null)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                // A Close retried after a timeout (the first one committed) is
                // answered with the closed sale, not a 404 that reads as a failure
                // while the money is already in the drawer. Its payment stays as
                // first recorded.
                var alreadyClosed = await _db.Orders.AsNoTracking().AnyAsync(o =>
                    o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Complete);
                if (alreadyClosed) return await GetOrderResponseAsync(orderId);
                throw new KeyNotFoundException("Draft order not found.");
            }

            var liveLines = draft.OrderLines.Where(l => l.DeletedAt == null).ToList();
            if (liveLines.Count == 0)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new ValidationException("Cannot close a draft with zero lines.");
            }

            // Cash short of the total used to close as paid. Total is priced the
            // way the reports price it (quantity x catalog price).
            if (request.AmountTendered.HasValue && request.PaymentMethod == "Cash")
            {
                var plantIds = liveLines.Select(l => l.PlantCatalogId).Distinct().ToList();
                var prices = await _db.PlantCatalogs.AsNoTracking()
                    .Where(p => plantIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => p.Price ?? 0m);
                var total = liveLines.Sum(l => l.QtyOrdered * prices.GetValueOrDefault(l.PlantCatalogId));
                if (request.AmountTendered.Value < total)
                {
                    await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                    throw new ValidationException(
                        $"Cash tendered (${request.AmountTendered.Value:0.00}) is less than the total (${total:0.00}).");
                }
            }

            draft.Status = OrderStatus.Complete;
            draft.PaymentMethod = request.PaymentMethod;
            draft.AmountTendered = request.AmountTendered;

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }

        return await GetOrderResponseAsync(orderId);
    }

    public async Task<OrderResponse> CancelDraftAsync(Guid orderId, string adminReason)
    {
        if (string.IsNullOrWhiteSpace(adminReason))
            throw new ValidationException("Admin reason is required for cancel draft.");

        return await WalkUpRowLocks.ExecuteWithRetryAsync(_db, () =>
            CancelDraftInternalAsync(orderId, adminReason));
    }

    private async Task<OrderResponse> CancelDraftInternalAsync(Guid orderId, string adminReason)
    {
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Lines are read inside the transaction (they were read before it), and
            // the order row is locked after the plants below, the lock a register
            // scan takes before writing. A scan that commits a line this read missed
            // makes the commit fail with 40001 and the retry restores that line too;
            // one still in flight is refused once the draft is cancelled.
            var draft = await _db.Orders
                .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft);
            if (draft == null)
            {
                await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
                throw new KeyNotFoundException("Draft order not found.");
            }

            // One plant at a time in ascending plant id, plant -> inventory -> line: the
            // canonical order in WalkUpRowLocks. Iterating in load order let two cancels
            // sharing two plants lock their inventory rows in opposite orders.
            var lines = draft.OrderLines
                .Where(l => l.DeletedAt == null)
                .OrderBy(l => l.PlantCatalogId)
                .ThenBy(l => l.Id)
                .ToList();

            foreach (var line in lines)
            {
                await WalkUpRowLocks.LockPlantAsync(_db, line.PlantCatalogId);
                await WalkUpRowLocks.LockOrderLinesAsync(_db, new[] { line.Id });

                var inventory = await _db.Inventories
                    .FirstOrDefaultAsync(i => i.PlantCatalogId == line.PlantCatalogId && i.DeletedAt == null);

                if (inventory != null)
                {
                    inventory.OnHandQty += line.QtyFulfilled;
                }

                line.DeletedAt = DateTimeOffset.UtcNow;
            }

            await WalkUpRowLocks.LockOrdersAsync(_db, new[] { orderId });

            draft.Status = OrderStatus.Cancelled;
            draft.DeletedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            // Audit per-line restore + the cancellation itself
            foreach (var line in lines)
            {
                await _adminService.LogActionAsync(
                    "WalkUpRegisterCancelLineRestore",
                    "OrderLine",
                    line.Id,
                    adminReason,
                    $"Restored {line.QtyFulfilled} units to inventory for plant {line.PlantCatalogId} on draft cancel.");
            }

            await _adminService.LogActionAsync(
                "WalkUpRegisterCancelDraft",
                "Order",
                orderId,
                adminReason,
                $"Cancelled draft {orderId}; restored inventory for {lines.Count} lines.");

            return await GetOrderResponseAsync(orderId, includeDeleted: true);
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
    }

    public async Task<List<OrderResponse>> GetOpenDraftsAsync(string? workstationName = null)
    {
        // workstationName is not currently persisted on the order; reserved for future use.
        var orders = await _db.Orders
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .ThenInclude(l => l.PlantCatalog)
            .Include(o => o.Customer)
            .Include(o => o.Seller)
            .Where(o => o.Status == OrderStatus.Draft && o.IsWalkUp && o.DeletedAt == null)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return orders.Select(MapToResponse).ToList();
    }

    private async Task<OrderResponse> GetOrderResponseAsync(Guid orderId, bool includeDeleted = false)
    {
        IQueryable<Order> query = _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Seller)
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .ThenInclude(l => l.PlantCatalog);

        if (includeDeleted)
            query = query.IgnoreQueryFilters();

        var order = await query.FirstAsync(o => o.Id == orderId);
        return MapToResponse(order);
    }

    private static OrderResponse MapToResponse(Order o) => new()
    {
        Id = o.Id,
        CustomerId = o.CustomerId,
        SellerId = o.SellerId,
        OrderNumber = o.OrderNumber,
        Status = o.Status,
        IsWalkUp = o.IsWalkUp,
        HasIssue = o.HasIssue,
        PaymentMethod = o.PaymentMethod,
        AmountTendered = o.AmountTendered,
        Customer = o.Customer == null ? null : new CustomerResponse
        {
            Id = o.Customer.Id,
            FirstName = o.Customer.FirstName,
            LastName = o.Customer.LastName,
            DisplayName = o.Customer.DisplayName,
            Phone = o.Customer.Phone,
            Email = o.Customer.Email,
            PickupCode = o.Customer.PickupCode,
            PicklistBarcode = o.Customer.PicklistBarcode,
            Notes = o.Customer.Notes,
            CreatedAt = o.Customer.CreatedAt,
            UpdatedAt = o.Customer.UpdatedAt
        },
        Seller = o.Seller == null ? null : new SellerResponse
        {
            Id = o.Seller.Id,
            FirstName = o.Seller.FirstName,
            LastName = o.Seller.LastName,
            DisplayName = o.Seller.DisplayName,
            Grade = o.Seller.Grade,
            Teacher = o.Seller.Teacher,
            PicklistBarcode = o.Seller.PicklistBarcode,
            CreatedAt = o.Seller.CreatedAt,
            UpdatedAt = o.Seller.UpdatedAt
        },
        Lines = o.OrderLines
            .Where(l => l.DeletedAt == null)
            .Select(l => new OrderLineResponse
            {
                Id = l.Id,
                OrderId = l.OrderId,
                PlantCatalogId = l.PlantCatalogId,
                PlantName = l.PlantCatalog?.Name ?? string.Empty,
                PlantSku = l.PlantCatalog?.Sku ?? string.Empty,
                QtyOrdered = l.QtyOrdered,
                QtyFulfilled = l.QtyFulfilled,
                Notes = l.Notes,
                LastScanIdempotencyKey = l.LastScanIdempotencyKey,
                CreatedAt = l.CreatedAt,
                UpdatedAt = l.UpdatedAt
            })
            .ToList(),
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
        DeletedAt = o.DeletedAt
    };
}
