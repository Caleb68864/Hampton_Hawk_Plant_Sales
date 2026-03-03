using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class OrderServiceTests
{
    private static OrderService CreateService(HamptonHawksPlantSales.Infrastructure.Data.AppDbContext db)
    {
        var protection = new Mock<IInventoryProtectionService>();
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.LogActionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = "1234" })
            .Build();

        return new OrderService(db, protection.Object, admin.Object, config);
    }

    [Fact]
    public async Task UpdateLine_WithQtyOnly_PreservesPlantAndUpdatesQty()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "SKU-OLD", barcode: "BC-OLD");
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 5 });

        Assert.Equal(5, response.QtyOrdered);
        Assert.Equal(plant.Id, response.PlantCatalogId);
    }

    [Fact]
    public async Task UpdateLine_WithQtyAndPlant_UpdatesBoth()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plantA = TestDataBuilder.CreatePlant(sku: "SKU-A", barcode: "BC-A");
        var plantB = TestDataBuilder.CreatePlant(sku: "SKU-B", barcode: "BC-B");
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plantA.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(plantA, plantB);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 5, PlantCatalogId = plantB.Id });

        Assert.Equal(5, response.QtyOrdered);
        Assert.Equal(plantB.Id, response.PlantCatalogId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task UpdateLine_InvalidQty_ReturnsValidation(int qty)
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = qty }));
    }
}
