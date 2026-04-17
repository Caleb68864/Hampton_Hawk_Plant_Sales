using System.Text.RegularExpressions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly IInventoryProtectionService _protection;
    private readonly IAdminService _adminService;
    private readonly IConfiguration _configuration;

    public OrderService(AppDbContext db, IInventoryProtectionService protection, IAdminService adminService, IConfiguration configuration)
    {
        _db = db;
        _protection = protection;
        _adminService = adminService;
        _configuration = configuration;
    }

    public async Task<PagedResult<OrderResponse>> GetAllAsync(
        string? search, OrderStatus? status, bool? isWalkUp, Guid? sellerId, Guid? customerId,
        bool includeDeleted, PaginationParams paging)
    {
        var query = includeDeleted
            ? _db.Orders.IgnoreQueryFilters().Include(o => o.Customer).Include(o => o.Seller).AsQueryable()
            : _db.Orders.Include(o => o.Customer).Include(o => o.Seller).AsQueryable();

        if (!includeDeleted)
            query = query.Where(o => o.DeletedAt == null);

        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        if (isWalkUp.HasValue)
            query = query.Where(o => o.IsWalkUp == isWalkUp.Value);

        if (sellerId.HasValue)
            query = query.Where(o => o.SellerId == sellerId.Value);

        if (customerId.HasValue)
            query = query.Where(o => o.CustomerId == customerId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(o =>
                o.OrderNumber.ToLower().Contains(term) ||
                (o.Barcode != null && o.Barcode.ToLower().Contains(term)) ||
                o.Customer.DisplayName.ToLower().Contains(term) ||
                o.Customer.PickupCode.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(o => MapToResponse(o, false))
            .ToListAsync();

        return new PagedResult<OrderResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<OrderResponse?> GetByIdAsync(Guid id)
    {
        var order = await _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Seller)
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .ThenInclude(l => l.PlantCatalog)
            .FirstOrDefaultAsync(o => o.Id == id && o.DeletedAt == null);

        return order == null ? null : MapToResponse(order, true);
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest request)
    {
        var orderNumber = string.IsNullOrWhiteSpace(request.OrderNumber)
            ? await GenerateOrderNumber()
            : request.OrderNumber;
        var order = new Order
        {
            CustomerId = request.CustomerId,
            SellerId = request.SellerId,
            OrderNumber = orderNumber,
            Barcode = BuildOrderBarcode(orderNumber),
            IsWalkUp = request.IsWalkUp
        };

        if (request.Lines != null)
        {
            foreach (var line in request.Lines)
            {
                order.OrderLines.Add(new OrderLine
                {
                    PlantCatalogId = line.PlantCatalogId,
                    QtyOrdered = line.QtyOrdered,
                    Notes = line.Notes
                });
            }
        }

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return (await GetByIdAsync(order.Id))!;
    }

    public async Task<OrderResponse> UpdateAsync(Guid id, UpdateOrderRequest request)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

        order.CustomerId = request.CustomerId;
        order.SellerId = request.SellerId;
        order.Status = request.Status;
        order.IsWalkUp = request.IsWalkUp;
        order.HasIssue = request.HasIssue;

        await _db.SaveChangesAsync();

        return (await GetByIdAsync(order.Id))!;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.DeletedAt == null);
        if (order == null) return false;

        order.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<OrderLineResponse> AddLineAsync(Guid orderId, CreateOrderLineRequest request, string? adminPin = null, string? adminReason = null)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order not found.");

        bool isOverride = false;

        if (order.IsWalkUp)
        {
            isOverride = TryAdminOverride(adminPin, adminReason);

            if (!isOverride)
            {
                var (allowed, available, errorMessage) = await _protection.ValidateWalkupLineAsync(request.PlantCatalogId, request.QtyOrdered);
                if (!allowed)
                    throw new ValidationException(errorMessage!);
            }
        }

        var line = new OrderLine
        {
            OrderId = orderId,
            PlantCatalogId = request.PlantCatalogId,
            QtyOrdered = request.QtyOrdered,
            Notes = request.Notes
        };

        _db.OrderLines.Add(line);

        if (isOverride)
            order.HasIssue = true;

        await _db.SaveChangesAsync();

        if (isOverride)
        {
            await _adminService.LogActionAsync(
                "WalkUpOverride",
                "OrderLine",
                line.Id,
                adminReason!,
                $"Added walk-up line via orders endpoint exceeding available inventory for plant {request.PlantCatalogId}, qty={request.QtyOrdered}");
        }

        var saved = await _db.OrderLines
            .Include(l => l.PlantCatalog)
            .FirstAsync(l => l.Id == line.Id);

        return MapLineToResponse(saved);
    }

    private bool TryAdminOverride(string? pin, string? reason)
    {
        if (string.IsNullOrWhiteSpace(pin))
            return false;

        var expectedPin = Environment.GetEnvironmentVariable("APP_ADMIN_PIN")
            ?? _configuration["AdminPin"]
            ?? string.Empty;

        if (pin != expectedPin)
            throw new ValidationException("Invalid admin PIN.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ValidationException("Admin reason is required for override.");

        return true;
    }

    public async Task<OrderLineResponse> UpdateLineAsync(Guid orderId, Guid lineId, UpdateOrderLineRequest request)
    {
        var line = await _db.OrderLines
            .Include(l => l.PlantCatalog)
            .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order line not found.");

        var newQtyOrdered = request.QtyOrdered ?? line.QtyOrdered;
        if (request.QtyOrdered.HasValue && request.QtyOrdered.Value <= 0)
            throw new ValidationException("QtyOrdered must be greater than 0.");

        if (newQtyOrdered < line.QtyFulfilled)
            throw new ValidationException($"Cannot reduce QtyOrdered below QtyFulfilled ({line.QtyFulfilled}).");

        var newPlantCatalogId = request.PlantCatalogId ?? line.PlantCatalogId;

        if (line.QtyFulfilled > 0 && newPlantCatalogId != line.PlantCatalogId)
            throw new ValidationException("Cannot change plant on a line that has been partially fulfilled.");

        var plantChanged = newPlantCatalogId != line.PlantCatalogId;
        line.PlantCatalogId = newPlantCatalogId;
        line.QtyOrdered = newQtyOrdered;
        line.Notes = request.Notes;

        await _db.SaveChangesAsync();

        // Reload plant catalog if changed
        if (plantChanged)
        {
            await _db.Entry(line).Reference(l => l.PlantCatalog).LoadAsync();
        }

        return MapLineToResponse(line);
    }

    public async Task<bool> DeleteLineAsync(Guid orderId, Guid lineId)
    {
        var line = await _db.OrderLines
            .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null);

        if (line == null) return false;

        if (line.QtyFulfilled > 0)
            throw new ValidationException("Cannot delete an order line that has been partially fulfilled.");

        line.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<string> GenerateOrderNumber()
    {
        // Plain integer sequence. Look at max numeric OrderNumber in use and increment.
        var existing = await _db.Orders
            .IgnoreQueryFilters()
            .Select(o => o.OrderNumber)
            .ToListAsync();
        var maxInt = existing
            .Select(n => int.TryParse(n, out var i) ? i : 0)
            .DefaultIfEmpty(0)
            .Max();
        return (maxInt + 1).ToString();
    }

    public static string BuildOrderBarcode(string orderNumber)
    {
        var digits = Regex.Replace(orderNumber ?? string.Empty, "\\D", string.Empty);
        if (digits.Length == 0)
        {
            // Fallback: hash-based numeric so arbitrary test/imported numbers still produce a stable 10-digit tail.
            var hash = (uint)(orderNumber ?? string.Empty).GetHashCode();
            digits = hash.ToString();
        }
        if (digits.Length > 10) digits = digits[^10..];
        return "OR" + digits.PadLeft(10, '0');
    }

    public async Task<int> RegenerateAllBarcodesAsync()
    {
        var orders = await _db.Orders.IgnoreQueryFilters().ToListAsync();
        var updated = 0;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var o in orders)
        {
            var candidate = BuildOrderBarcode(o.OrderNumber);
            var finalBarcode = candidate;
            var suffix = 2;
            while (!seen.Add(finalBarcode))
            {
                finalBarcode = candidate + "-" + suffix++;
            }
            if (o.Barcode != finalBarcode)
            {
                o.Barcode = finalBarcode;
                updated++;
            }
        }
        await _db.SaveChangesAsync();
        return updated;
    }

    public async Task<int> DeleteAllOrdersAsync()
    {
        // Hard delete all orders and their dependents. Used only from the admin danger-zone action.
        using var tx = await _db.Database.BeginTransactionAsync();
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM \"FulfillmentEvents\"");
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM \"OrderLines\"");
        var count = await _db.Database.ExecuteSqlRawAsync("DELETE FROM \"Orders\"");
        await tx.CommitAsync();
        return count;
    }

    private static OrderResponse MapToResponse(Order o, bool includeLines) => new()
    {
        Id = o.Id,
        CustomerId = o.CustomerId,
        SellerId = o.SellerId,
        OrderNumber = o.OrderNumber,
        Barcode = o.Barcode,
        Status = o.Status,
        IsWalkUp = o.IsWalkUp,
        HasIssue = o.HasIssue,
        Customer = o.Customer == null ? null : new CustomerResponse
        {
            Id = o.Customer.Id,
            FirstName = o.Customer.FirstName,
            LastName = o.Customer.LastName,
            DisplayName = o.Customer.DisplayName,
            Phone = o.Customer.Phone,
            Email = o.Customer.Email,
            PickupCode = o.Customer.PickupCode,
            Notes = o.Customer.Notes,
            CreatedAt = o.Customer.CreatedAt,
            UpdatedAt = o.Customer.UpdatedAt,
            DeletedAt = o.Customer.DeletedAt
        },
        Seller = o.Seller == null ? null : new SellerResponse
        {
            Id = o.Seller.Id,
            FirstName = o.Seller.FirstName,
            LastName = o.Seller.LastName,
            DisplayName = o.Seller.DisplayName,
            Grade = o.Seller.Grade,
            Teacher = o.Seller.Teacher,
            CreatedAt = o.Seller.CreatedAt,
            UpdatedAt = o.Seller.UpdatedAt,
            DeletedAt = o.Seller.DeletedAt
        },
        Lines = includeLines
            ? o.OrderLines.Select(MapLineToResponse).ToList()
            : new List<OrderLineResponse>(),
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
        DeletedAt = o.DeletedAt
    };

    private static OrderLineResponse MapLineToResponse(OrderLine l) => new()
    {
        Id = l.Id,
        OrderId = l.OrderId,
        PlantCatalogId = l.PlantCatalogId,
        PlantName = l.PlantCatalog?.Name ?? string.Empty,
        PlantSku = l.PlantCatalog?.Sku ?? string.Empty,
        QtyOrdered = l.QtyOrdered,
        QtyFulfilled = l.QtyFulfilled,
        Notes = l.Notes,
        CreatedAt = l.CreatedAt,
        UpdatedAt = l.UpdatedAt
    };
}
