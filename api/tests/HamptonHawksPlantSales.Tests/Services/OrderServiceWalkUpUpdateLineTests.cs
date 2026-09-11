using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// PUT /api/orders/{id}/lines/{lineId} was the last route that could raise a
/// walk-up line's quantity (or move it to another plant) without the availability
/// check. These run the real <see cref="InventoryProtectionService"/> so the
/// increment is validated against actual commitments.
/// </summary>
public class OrderServiceWalkUpUpdateLineTests
{
    private static OrderService CreateService(AppDbContext db)
    {
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.LogActionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = "1234" })
            .Build();

        return new OrderService(db, new InventoryProtectionService(db), admin.Object, config);
    }

    private static async Task<(Order Order, OrderLine Line, PlantCatalog Plant)> Seed(
        AppDbContext db, bool isWalkUp, int onHand, int qtyOrdered)
    {
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "SKU-UPD", barcode: "BC-UPD");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: qtyOrdered, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: onHand));
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();
        return (order, line, plant);
    }

    [Fact]
    public async Task UpdateLine_WalkUp_IncreaseBeyondAvailability_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        // 5 on hand, 3 already promised to this line: only 2 more can be added.
        var (order, line, _) = await Seed(db, isWalkUp: true, onHand: 5, qtyOrdered: 3);
        var service = CreateService(db);

        var act = () => service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 6 });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*available for walk-up*");
        (await db.OrderLines.AsNoTracking().FirstAsync(l => l.Id == line.Id)).QtyOrdered.Should().Be(3);
    }

    [Fact]
    public async Task UpdateLine_WalkUp_IncreaseWithinAvailability_Succeeds()
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, _) = await Seed(db, isWalkUp: true, onHand: 5, qtyOrdered: 3);
        var service = CreateService(db);

        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 5 });

        response.QtyOrdered.Should().Be(5);
    }

    [Fact]
    public async Task UpdateLine_WalkUp_DecreaseNeverValidatesAvailability()
    {
        using var db = MockDbContextFactory.Create();
        // Oversold already (0 on hand); reducing must still be allowed.
        var (order, line, _) = await Seed(db, isWalkUp: true, onHand: 0, qtyOrdered: 3);
        var service = CreateService(db);

        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 1 });

        response.QtyOrdered.Should().Be(1);
    }

    [Fact]
    public async Task UpdateLine_WalkUp_MoveToPlantWithoutStock_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, _) = await Seed(db, isWalkUp: true, onHand: 10, qtyOrdered: 3);
        var other = TestDataBuilder.CreatePlant(sku: "SKU-OTHER", barcode: "BC-OTHER");
        db.PlantCatalogs.Add(other);
        db.Inventories.Add(TestDataBuilder.CreateInventory(other.Id, onHandQty: 1));
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { PlantCatalogId = other.Id });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*available for walk-up*");
    }

    [Fact]
    public async Task UpdateLine_Preorder_IsNotSubjectToWalkUpAvailability()
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, _) = await Seed(db, isWalkUp: false, onHand: 1, qtyOrdered: 3);
        var service = CreateService(db);

        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 50 });

        response.QtyOrdered.Should().Be(50);
    }
}
