using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// A force-completed order can carry an unfulfilled remainder. Those units were
/// never handed over and nobody is coming back for them, so they must not keep
/// reducing walk-up availability for the rest of the sale.
/// </summary>
public class WalkUpAvailabilityCompletedOrderTests
{
    [Fact]
    public async Task Availability_IgnoresUnfulfilledRemainderOfCompletedOrder()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var forced = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        // Force-completed with 2 of 5 handed over: 3 units never left the table.
        var line = TestDataBuilder.CreateOrderLine(forced.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 8));
        db.Customers.Add(customer);
        db.Orders.Add(forced);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        (await service.GetAvailableForWalkupAsync(plant.Id)).Should().Be(8);

        var all = await service.GetAllAvailabilityAsync();
        all.Single(a => a.PlantCatalogId == plant.Id).OutstandingCommitments.Should().Be(0);
        all.Single(a => a.PlantCatalogId == plant.Id).AvailableForWalkup.Should().Be(8);
    }

    [Fact]
    public async Task Availability_StillCountsInProgressRemainder()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var inProgress = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(inProgress.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 8));
        db.Customers.Add(customer);
        db.Orders.Add(inProgress);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        (await new InventoryProtectionService(db).GetAvailableForWalkupAsync(plant.Id)).Should().Be(5);
    }
}
