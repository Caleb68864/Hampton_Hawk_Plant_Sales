using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

public class InventoryProtectionServiceTests
{
    [Fact]
    public async Task CalculateAvailableForWalkup_NoPreorders_ReturnsFullInventory()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 50);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        // Act
        var available = await service.GetAvailableForWalkupAsync(plant.Id);

        // Assert
        available.Should().Be(50);
    }

    [Fact]
    public async Task CalculateAvailableForWalkup_WithPreorders_SubtractsRemaining()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 50);
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 20, qtyFulfilled: 5);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        // Act
        var available = await service.GetAvailableForWalkupAsync(plant.Id);

        // Assert: 50 onHand - (20 ordered - 5 fulfilled) = 50 - 15 = 35
        available.Should().Be(35);
    }

    [Fact]
    public async Task CalculateAvailableForWalkup_MultiplePreorders_SumsRemaining()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 100);
        var customer = TestDataBuilder.CreateCustomer();

        var preorder1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var line1 = TestDataBuilder.CreateOrderLine(preorder1.Id, plant.Id, qtyOrdered: 30, qtyFulfilled: 10);

        var preorder2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress, isWalkUp: false);
        var line2 = TestDataBuilder.CreateOrderLine(preorder2.Id, plant.Id, qtyOrdered: 25, qtyFulfilled: 5);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.AddRange(preorder1, preorder2);
        db.OrderLines.AddRange(line1, line2);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        // Act
        var available = await service.GetAvailableForWalkupAsync(plant.Id);

        // Assert: 100 - ((30-10) + (25-5)) = 100 - (20 + 20) = 60
        available.Should().Be(60);
    }

    [Fact]
    public async Task CalculateAvailableForWalkup_CancelledOrdersExcluded()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 50);
        var customer = TestDataBuilder.CreateCustomer();

        // Active preorder
        var activeOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var activeLine = TestDataBuilder.CreateOrderLine(activeOrder.Id, plant.Id, qtyOrdered: 10, qtyFulfilled: 0);

        // Cancelled preorder -- should be excluded
        var cancelledOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Cancelled, isWalkUp: false);
        var cancelledLine = TestDataBuilder.CreateOrderLine(cancelledOrder.Id, plant.Id, qtyOrdered: 20, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.AddRange(activeOrder, cancelledOrder);
        db.OrderLines.AddRange(activeLine, cancelledLine);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        // Act
        var available = await service.GetAvailableForWalkupAsync(plant.Id);

        // Assert: 50 - 10 = 40 (cancelled order's 20 is excluded)
        available.Should().Be(40);
    }

    [Fact]
    public async Task CalculateAvailableForWalkup_WalkupOrdersExcluded()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant();
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 50);
        var customer = TestDataBuilder.CreateCustomer();

        // Preorder (not walk-up)
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 10, qtyFulfilled: 0);

        // Walk-up order -- should be excluded from preorder remaining
        var walkupOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var walkupLine = TestDataBuilder.CreateOrderLine(walkupOrder.Id, plant.Id, qtyOrdered: 15, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.AddRange(preorder, walkupOrder);
        db.OrderLines.AddRange(preorderLine, walkupLine);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        // Act
        var available = await service.GetAvailableForWalkupAsync(plant.Id);

        // Assert: 50 - 10 = 40 (walk-up order's 15 is excluded)
        available.Should().Be(40);
    }


    [Fact]
    public async Task GetAllAvailability_OnlyReturnsActiveNonDeletedPlants_WithComputedAvailability()
    {
        using var db = MockDbContextFactory.Create();

        var activePlant = TestDataBuilder.CreatePlant(name: "Active Plant", sku: "ACTIVE", barcode: "ACTIVE-BC");
        var inactivePlant = TestDataBuilder.CreatePlant(name: "Inactive Plant", sku: "INACTIVE", barcode: "INACTIVE-BC");
        inactivePlant.IsActive = false;
        var deletedPlant = TestDataBuilder.CreatePlant(name: "Deleted Plant", sku: "DELETED", barcode: "DELETED-BC");
        deletedPlant.DeletedAt = DateTimeOffset.UtcNow;

        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, activePlant.Id, qtyOrdered: 8, qtyFulfilled: 3);

        db.PlantCatalogs.AddRange(activePlant, inactivePlant, deletedPlant);
        db.Inventories.AddRange(
            TestDataBuilder.CreateInventory(activePlant.Id, onHandQty: 12),
            TestDataBuilder.CreateInventory(inactivePlant.Id, onHandQty: 99),
            TestDataBuilder.CreateInventory(deletedPlant.Id, onHandQty: 99));
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        var result = await service.GetAllAvailabilityAsync();

        result.Should().HaveCount(1);
        var availability = result.Single();
        availability.PlantCatalogId.Should().Be(activePlant.Id);
        availability.OnHandQty.Should().Be(12);
        availability.PreorderRemaining.Should().Be(5);
        availability.AvailableForWalkup.Should().Be(7);
    }

    [Fact]
    public async Task ValidateWalkupLine_WhenOverRequested_ReturnsHelpfulErrorAndAvailableCount()
    {
        using var db = MockDbContextFactory.Create();

        var plant = TestDataBuilder.CreatePlant(name: "Blue Hydrangea");
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 6, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5));
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        var result = await service.ValidateWalkupLineAsync(plant.Id, requestedQty: 2);

        result.Allowed.Should().BeFalse();
        result.Available.Should().Be(1);
        result.ErrorMessage.Should().NotBeNull();
        result.ErrorMessage.Should().Contain("Only 1 units");
        result.ErrorMessage.Should().Contain("Blue Hydrangea");
    }

    [Fact]
    public async Task ValidateWalkupLine_WithExcludeOrderId_IgnoresThatOrderReservation()
    {
        using var db = MockDbContextFactory.Create();

        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();

        var orderToEdit = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var lineOnEditedOrder = TestDataBuilder.CreateOrderLine(orderToEdit.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);

        var secondOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var lineOnSecondOrder = TestDataBuilder.CreateOrderLine(secondOrder.Id, plant.Id, qtyOrdered: 4, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        db.Customers.Add(customer);
        db.Orders.AddRange(orderToEdit, secondOrder);
        db.OrderLines.AddRange(lineOnEditedOrder, lineOnSecondOrder);
        await db.SaveChangesAsync();

        var service = new InventoryProtectionService(db);

        var withoutExclude = await service.ValidateWalkupLineAsync(plant.Id, requestedQty: 2);
        var withExclude = await service.ValidateWalkupLineAsync(plant.Id, requestedQty: 2, excludeOrderId: orderToEdit.Id);

        withoutExclude.Allowed.Should().BeFalse();
        withoutExclude.Available.Should().Be(1);

        withExclude.Allowed.Should().BeTrue();
        withExclude.Available.Should().Be(6);
    }

}
