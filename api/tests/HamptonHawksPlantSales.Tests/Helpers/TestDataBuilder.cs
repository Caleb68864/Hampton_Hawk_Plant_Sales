using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;

namespace HamptonHawksPlantSales.Tests.Helpers;

public static class TestDataBuilder
{
    public static PlantCatalog CreatePlant(string name = "Test Plant", string barcode = "BC-001", string sku = "SKU-001")
    {
        return new PlantCatalog
        {
            Id = Guid.NewGuid(),
            Name = name,
            Sku = sku,
            Barcode = barcode,
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static Customer CreateCustomer(string displayName = "Test Customer")
    {
        return new Customer
        {
            Id = Guid.NewGuid(),
            DisplayName = displayName,
            PickupCode = "ABC123",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static Order CreateOrder(Guid customerId, OrderStatus status = OrderStatus.Open, bool isWalkUp = false)
    {
        return new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            OrderNumber = $"ORD-{Guid.NewGuid().ToString()[..5]}",
            Status = status,
            IsWalkUp = isWalkUp,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static OrderLine CreateOrderLine(Guid orderId, Guid plantCatalogId, int qtyOrdered = 5, int qtyFulfilled = 0)
    {
        return new OrderLine
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            PlantCatalogId = plantCatalogId,
            QtyOrdered = qtyOrdered,
            QtyFulfilled = qtyFulfilled,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static Inventory CreateInventory(Guid plantCatalogId, int onHandQty = 100)
    {
        return new Inventory
        {
            Id = Guid.NewGuid(),
            PlantCatalogId = plantCatalogId,
            OnHandQty = onHandQty,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public static AppSettings CreateAppSettings(bool saleClosed = false)
    {
        return new AppSettings
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            SaleClosed = saleClosed,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }
}
