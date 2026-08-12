using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// Walk-up availability must account for every outstanding commitment, not just
/// preorders. A walk-up line that has not been fulfilled yet holds a plant just as
/// firmly as a preorder line does: the stock is spoken for but still sitting in
/// OnHandQty. Counting only preorders let the same unit be sold repeatedly.
///
/// The rule that makes both order types work with one formula: subtract what is
/// promised but not yet handed over. Fulfilled quantities are already reflected in
/// OnHandQty, so they must not be subtracted twice -- that is why the register's
/// scan-time decrement (QtyOrdered == QtyFulfilled) contributes nothing here.
/// </summary>
public class WalkUpAvailabilityCommitmentTests
{
    [Fact]
    public async Task Availability_WithUnfulfilledWalkUpLine_SubtractsIt()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        db.Customers.Add(customer);
        db.Orders.Add(walkUp);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var available = await new InventoryProtectionService(db).GetAvailableForWalkupAsync(plant.Id);

        available.Should().Be(7, "three units are promised to an open walk-up order");
    }

    [Fact]
    public async Task Availability_WithFulfilledWalkUpLine_DoesNotDoubleCount()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);

        // How the register records a sale: inventory already decremented at scan time,
        // so the line is fully fulfilled and must not reduce availability again.
        var line = TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 4, qtyFulfilled: 4);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 6));
        db.Customers.Add(customer);
        db.Orders.Add(walkUp);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var available = await new InventoryProtectionService(db).GetAvailableForWalkupAsync(plant.Id);

        available.Should().Be(6, "the sale is already reflected in OnHandQty");
    }

    [Fact]
    public async Task Availability_WithPartiallyFulfilledWalkUpLine_SubtractsOnlyTheRemainder()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        db.Customers.Add(customer);
        db.Orders.Add(walkUp);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var available = await new InventoryProtectionService(db).GetAvailableForWalkupAsync(plant.Id);

        available.Should().Be(7, "only the 3 unfulfilled units are still outstanding");
    }

    [Fact]
    public async Task Availability_WithCancelledWalkUpOrder_IgnoresIt()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var cancelled = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Cancelled, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(cancelled.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 8));
        db.Customers.Add(customer);
        db.Orders.Add(cancelled);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var available = await new InventoryProtectionService(db).GetAvailableForWalkupAsync(plant.Id);

        available.Should().Be(8, "a cancelled order releases its claim");
    }

    [Fact]
    public async Task Validate_WhenWalkUpCommitmentsConsumeTheStock_Rejects()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 1, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 1));
        db.Customers.Add(customer);
        db.Orders.Add(walkUp);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        // The last unit is already on a walk-up order; a second buyer cannot have it.
        var (allowed, available, error) = await new InventoryProtectionService(db)
            .ValidateWalkupLineAsync(plant.Id, requestedQty: 1);

        allowed.Should().BeFalse();
        available.Should().Be(0);
        error.Should().NotBeNull();
    }

    [Fact]
    public async Task Validate_ExcludingOwnOrder_DoesNotCountItsOwnLine()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5));
        db.Customers.Add(customer);
        db.Orders.Add(walkUp);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        // Editing this order's own line must not treat its existing quantity as
        // competing demand, or raising 2 -> 4 would be blocked by itself.
        var (allowed, available, _) = await new InventoryProtectionService(db)
            .ValidateWalkupLineAsync(plant.Id, requestedQty: 4, excludeOrderId: walkUp.Id);

        allowed.Should().BeTrue();
        available.Should().Be(5);
    }

    [Fact]
    public async Task GetAllAvailability_MatchesPerPlantCalculation()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var walkUp = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 20));
        db.Customers.Add(customer);
        db.Orders.AddRange(walkUp, preorder);
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(walkUp.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 1));
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);
        var all = await service.GetAllAvailabilityAsync();
        var single = await service.GetAvailableForWalkupAsync(plant.Id);

        // 20 - 3 outstanding walk-up - 4 outstanding preorder = 13
        single.Should().Be(13);
        all.Should().ContainSingle(a => a.PlantCatalogId == plant.Id)
            .Which.AvailableForWalkup.Should().Be(13, "the list and single-plant paths must not disagree");
    }
}
