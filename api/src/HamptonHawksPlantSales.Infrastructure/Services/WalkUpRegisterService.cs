using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class WalkUpRegisterService : IWalkUpRegisterService
{
    private readonly AppDbContext _db;
    private readonly IInventoryProtectionService _protection;
    private readonly IAdminService _adminService;

    public WalkUpRegisterService(
        AppDbContext db,
        IInventoryProtectionService protection,
        IAdminService adminService)
    {
        _db = db;
        _protection = protection;
        _adminService = adminService;
    }

    public async Task<OrderResponse> CreateDraftAsync(CreateDraftRequest request)
    {
        var order = new Order
        {
            CustomerId = null,
            OrderNumber = await GenerateOrderNumberAsync(),
            IsWalkUp = true,
            Status = OrderStatus.Draft
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return await GetOrderResponseAsync(order.Id);
    }

    public async Task<OrderResponse> ScanIntoDraftAsync(Guid orderId, ScanIntoDraftRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PlantBarcode))
            throw new ValidationException("PlantBarcode is required.");
        if (string.IsNullOrWhiteSpace(request.ScanId))
            throw new ValidationException("ScanId is required.");

        var barcode = request.PlantBarcode.Trim();
        var scanId = request.ScanId.Trim();

        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

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
                if (transaction != null) await transaction.RollbackAsync();
                throw new ValidationException($"No plant found for barcode '{barcode}'.");
            }

            if (isRelational)
            {
                // Lock the plant catalog row
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"PlantCatalogs\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    plant.Id);

                // Lock inventory row
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    plant.Id);

                // Lock the existing order line if any
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"OrderId\" = {0} AND \"PlantCatalogId\" = {1} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    orderId, plant.Id);
            }

            var existingLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.OrderId == orderId && l.PlantCatalogId == plant.Id && l.DeletedAt == null);

            // Idempotency: if the existing line was last updated with the same scanId, no-op.
            if (existingLine != null
                && !string.IsNullOrEmpty(existingLine.LastScanIdempotencyKey)
                && existingLine.LastScanIdempotencyKey == scanId)
            {
                if (transaction != null) await transaction.CommitAsync();
                return await GetOrderResponseAsync(orderId);
            }

            // Multi-quantity scanning: coerce non-positive to 1 so the API stays
            // backward compatible for callers that omit/send 0.
            var requestedAdd = request.Quantity <= 0 ? 1 : request.Quantity;

            var currentQty = existingLine?.QtyFulfilled ?? 0;
            var requestedTotal = currentQty + requestedAdd;

            var (allowed, available, errorMessage) = await _protection.ValidateWalkupLineAsync(plant.Id, requestedTotal, orderId);
            if (!allowed)
            {
                if (transaction != null) await transaction.RollbackAsync();
                throw new ValidationException(errorMessage ?? "Walk-up availability exceeded.");
            }

            var inventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plant.Id && i.DeletedAt == null);

            if (inventory == null || inventory.OnHandQty <= 0)
            {
                if (transaction != null) await transaction.RollbackAsync();
                throw new ValidationException($"Plant '{plant.Name}' is out of stock.");
            }

            // Cap the additive amount at remaining on-hand inventory. Walk-up
            // availability has already been validated above for the requested
            // total, so on-hand is the remaining ceiling.
            var appliedAdd = Math.Min(requestedAdd, inventory.OnHandQty);
            if (appliedAdd <= 0)
            {
                if (transaction != null) await transaction.RollbackAsync();
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

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            return await GetOrderResponseAsync(orderId);
        }
        catch
        {
            if (transaction != null) await transaction.RollbackAsync();
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

        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            if (isRelational)
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    lineId);

                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    request.PlantCatalogId);
            }

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
                // Increasing quantity — must validate walk-up availability
                var (allowed, _, errorMessage) = await _protection.ValidateWalkupLineAsync(line.PlantCatalogId, request.NewQty, orderId);

                if (!allowed)
                {
                    var hasOverride = !string.IsNullOrWhiteSpace(adminReason);
                    if (!hasOverride)
                    {
                        if (transaction != null) await transaction.RollbackAsync();
                        throw new ValidationException(errorMessage ?? "Walk-up availability exceeded; admin override required.");
                    }
                }

                if (inventory.OnHandQty < diff)
                {
                    // Out of stock — even override cannot create negative inventory unless admin reason provided.
                    if (string.IsNullOrWhiteSpace(adminReason))
                    {
                        if (transaction != null) await transaction.RollbackAsync();
                        throw new ValidationException("Insufficient inventory to increase line quantity.");
                    }
                }

                inventory.OnHandQty -= diff;
                line.QtyOrdered = request.NewQty;
                line.QtyFulfilled = request.NewQty;

                if (!string.IsNullOrWhiteSpace(adminReason))
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
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OrderResponse> VoidLineAsync(Guid orderId, Guid lineId, string adminReason)
    {
        if (string.IsNullOrWhiteSpace(adminReason))
            throw new ValidationException("Admin reason is required for void line.");

        var draft = await _db.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            if (isRelational)
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    lineId);
            }

            var line = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
                ?? throw new KeyNotFoundException("Order line not found.");

            if (isRelational)
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    line.PlantCatalogId);
            }

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
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<OrderResponse> CloseDraftAsync(Guid orderId, CloseDraftRequest request)
    {
        var draft = await _db.Orders
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var liveLines = draft.OrderLines.Where(l => l.DeletedAt == null).ToList();
        if (liveLines.Count == 0)
            throw new ValidationException("Cannot close a draft with zero lines.");

        draft.Status = OrderStatus.Complete;
        draft.PaymentMethod = request.PaymentMethod;
        draft.AmountTendered = request.AmountTendered;

        await _db.SaveChangesAsync();

        return await GetOrderResponseAsync(orderId);
    }

    public async Task<OrderResponse> CancelDraftAsync(Guid orderId, string adminReason)
    {
        if (string.IsNullOrWhiteSpace(adminReason))
            throw new ValidationException("Admin reason is required for cancel draft.");

        var draft = await _db.Orders
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp && o.Status == OrderStatus.Draft)
            ?? throw new KeyNotFoundException("Draft order not found.");

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            var lines = draft.OrderLines.Where(l => l.DeletedAt == null).ToList();

            foreach (var line in lines)
            {
                if (isRelational)
                {
                    await _db.Database.ExecuteSqlRawAsync(
                        "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                        line.PlantCatalogId);
                }

                var inventory = await _db.Inventories
                    .FirstOrDefaultAsync(i => i.PlantCatalogId == line.PlantCatalogId && i.DeletedAt == null);

                if (inventory != null)
                {
                    inventory.OnHandQty += line.QtyFulfilled;
                }

                line.DeletedAt = DateTimeOffset.UtcNow;
            }

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
            if (transaction != null) await transaction.RollbackAsync();
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

    private async Task<string> GenerateOrderNumberAsync()
    {
        var count = await _db.Orders.CountAsync();
        return $"WLK-{count + 1:D5}";
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
