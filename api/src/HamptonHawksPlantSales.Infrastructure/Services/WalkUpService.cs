using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class WalkUpService : IWalkUpService
{
    private readonly AppDbContext _db;
    private readonly IInventoryProtectionService _protection;
    private readonly IAdminService _adminService;
    private readonly IConfiguration _configuration;

    public WalkUpService(AppDbContext db, IInventoryProtectionService protection, IAdminService adminService, IConfiguration configuration)
    {
        _db = db;
        _protection = protection;
        _adminService = adminService;
        _configuration = configuration;
    }

    public async Task<OrderResponse> CreateWalkUpOrderAsync(CreateWalkUpOrderRequest request)
    {
        Guid customerId;

        if (request.CustomerId.HasValue)
        {
            var existing = await _db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value && c.DeletedAt == null)
                ?? throw new KeyNotFoundException("Customer not found.");
            customerId = existing.Id;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.DisplayName))
                throw new ValidationException("DisplayName is required when creating a new walk-up customer.");

            var customer = new Customer
            {
                DisplayName = request.DisplayName,
                Phone = request.Phone,
                Email = request.Email,
                PickupCode = GeneratePickupCode(),
                Notes = request.Notes
            };

            _db.Customers.Add(customer);
            await _db.SaveChangesAsync();
            customerId = customer.Id;
        }

        var order = new Order
        {
            CustomerId = customerId,
            OrderNumber = await GenerateOrderNumber(),
            IsWalkUp = true,
            Status = OrderStatus.Open
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return await GetOrderResponseAsync(order.Id);
    }

    public async Task<OrderLineResponse> AddWalkUpLineAsync(Guid orderId, AddWalkUpLineRequest request, string? adminPin = null, string? adminReason = null)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp)
            ?? throw new KeyNotFoundException("Walk-up order not found.");

        var isOverride = TryAdminOverride(adminPin, adminReason);

        if (!isOverride)
        {
            var (allowed, available, errorMessage) = await _protection.ValidateWalkupLineAsync(request.PlantCatalogId, request.QtyOrdered);
            if (!allowed)
                throw new ValidationException(errorMessage!);
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
                $"Added walk-up line exceeding available inventory for plant {request.PlantCatalogId}, qty={request.QtyOrdered}");
        }

        var saved = await _db.OrderLines
            .Include(l => l.PlantCatalog)
            .FirstAsync(l => l.Id == line.Id);

        return MapLineToResponse(saved);
    }

    public async Task<OrderLineResponse> UpdateWalkUpLineAsync(Guid orderId, Guid lineId, UpdateWalkUpLineRequest request, string? adminPin = null, string? adminReason = null)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.DeletedAt == null && o.IsWalkUp)
            ?? throw new KeyNotFoundException("Walk-up order not found.");

        var line = await _db.OrderLines
            .Include(l => l.PlantCatalog)
            .FirstOrDefaultAsync(l => l.Id == lineId && l.OrderId == orderId && l.DeletedAt == null)
            ?? throw new KeyNotFoundException("Order line not found.");

        var isOverride = TryAdminOverride(adminPin, adminReason);

        if (!isOverride)
        {
            var (allowed, available, errorMessage) = await _protection.ValidateWalkupLineAsync(request.PlantCatalogId, request.QtyOrdered, orderId);
            if (!allowed)
                throw new ValidationException(errorMessage!);
        }

        if (request.QtyOrdered < line.QtyFulfilled)
            throw new ValidationException($"Cannot reduce QtyOrdered below QtyFulfilled ({line.QtyFulfilled}).");

        if (line.QtyFulfilled > 0 && request.PlantCatalogId != line.PlantCatalogId)
            throw new ValidationException("Cannot change plant on a line that has been partially fulfilled.");

        line.PlantCatalogId = request.PlantCatalogId;
        line.QtyOrdered = request.QtyOrdered;
        line.Notes = request.Notes;

        if (isOverride)
        {
            order.HasIssue = true;
            await _adminService.LogActionAsync(
                "WalkUpOverride",
                "OrderLine",
                lineId,
                adminReason!,
                $"Updated walk-up line exceeding available inventory for plant {request.PlantCatalogId}, qty={request.QtyOrdered}");
        }

        await _db.SaveChangesAsync();

        if (line.PlantCatalog.Id != request.PlantCatalogId)
            await _db.Entry(line).Reference(l => l.PlantCatalog).LoadAsync();

        return MapLineToResponse(line);
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

    private async Task<string> GenerateOrderNumber()
    {
        var count = await _db.Orders.CountAsync();
        return $"WLK-{count + 1:D5}";
    }

    private static string GeneratePickupCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private async Task<OrderResponse> GetOrderResponseAsync(Guid orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Seller)
            .Include(o => o.OrderLines.Where(l => l.DeletedAt == null))
                .ThenInclude(l => l.PlantCatalog)
            .FirstAsync(o => o.Id == orderId);

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
            CreatedAt = o.Seller.CreatedAt,
            UpdatedAt = o.Seller.UpdatedAt
        },
        Lines = o.OrderLines.Select(MapLineToResponse).ToList(),
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
        LastScanIdempotencyKey = l.LastScanIdempotencyKey,
        CreatedAt = l.CreatedAt,
        UpdatedAt = l.UpdatedAt
    };
}
