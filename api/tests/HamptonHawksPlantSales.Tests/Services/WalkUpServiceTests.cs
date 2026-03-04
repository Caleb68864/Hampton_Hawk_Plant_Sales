using FluentAssertions;
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

public class WalkUpServiceTests
{
    private AppDbContext CreateDb() => MockDbContextFactory.Create();

    private (WalkUpService Service, Mock<IInventoryProtectionService> ProtectionMock, Mock<IAdminService> AdminMock) CreateService(
        AppDbContext db,
        int defaultAvailable = 100)
    {
        var protectionMock = new Mock<IInventoryProtectionService>();
        protectionMock
            .Setup(p => p.ValidateWalkupLineAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<Guid?>()))
            .ReturnsAsync((Guid plantId, int qty, Guid? excludeId) => (true, defaultAvailable, null));

        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AdminPin"] = "1234"
            })
            .Build();

        var service = new WalkUpService(db, protectionMock.Object, adminMock.Object, config);
        return (service, protectionMock, adminMock);
    }

    // --- EP-12: Create Walk-Up Order Tests ---

    [Fact]
    public async Task CreateWalkUpOrder_WithDisplayName_CreatesCustomerAndOrder()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);

        var request = new CreateWalkUpOrderRequest
        {
            DisplayName = "Jane Walk-Up",
            Phone = "555-9999",
            Notes = "EP-12 test order"
        };

        // Act
        var result = await service.CreateWalkUpOrderAsync(request);

        // Assert: order is marked as walk-up
        result.IsWalkUp.Should().BeTrue();
        result.Id.Should().NotBe(Guid.Empty);
        result.CustomerId.Should().NotBe(Guid.Empty);
        result.OrderNumber.Should().NotBeNullOrEmpty();

        // Assert: customer was auto-created with correct data
        var customer = await db.Customers.FindAsync(result.CustomerId);
        customer.Should().NotBeNull();
        customer!.DisplayName.Should().Be("Jane Walk-Up");
        customer.Phone.Should().Be("555-9999");
    }

    [Fact]
    public async Task CreateWalkUpOrder_WithExistingCustomerId_ReusesCustomer()
    {
        // Arrange
        using var db = CreateDb();
        var existingCustomer = TestDataBuilder.CreateCustomer("Existing Walk-Up Customer");
        db.Customers.Add(existingCustomer);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new CreateWalkUpOrderRequest
        {
            CustomerId = existingCustomer.Id
        };

        // Act
        var result = await service.CreateWalkUpOrderAsync(request);

        // Assert: the order uses the existing customer
        result.CustomerId.Should().Be(existingCustomer.Id);
        result.IsWalkUp.Should().BeTrue();

        // No new customer should have been created
        var customerCount = await db.Customers.CountAsync();
        customerCount.Should().Be(1);
    }

    [Fact]
    public async Task CreateWalkUpOrder_WithInvalidCustomerId_ThrowsKeyNotFound()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);

        var request = new CreateWalkUpOrderRequest
        {
            CustomerId = Guid.NewGuid()
        };

        // Act & Assert
        var act = () => service.CreateWalkUpOrderAsync(request);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Customer not found*");
    }

    [Fact]
    public async Task CreateWalkUpOrder_WithoutDisplayNameOrCustomerId_ThrowsValidation()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);

        var request = new CreateWalkUpOrderRequest
        {
            DisplayName = "",
            Phone = "555-0000"
        };

        // Act & Assert
        var act = () => service.CreateWalkUpOrderAsync(request);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*DisplayName is required*");
    }

    [Fact]
    public async Task CreateWalkUpOrder_OrderHasStatusOpen()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);

        var request = new CreateWalkUpOrderRequest
        {
            DisplayName = "Status Check Buyer",
            Phone = "555-1111"
        };

        // Act
        var result = await service.CreateWalkUpOrderAsync(request);

        // Assert
        result.Status.Should().Be(OrderStatus.Open);
    }

    // --- EP-13: Add Line to Walk-Up Order Tests ---

    [Fact]
    public async Task AddWalkUpLine_ValidRequest_CreatesLineSuccessfully()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP13", sku: "EP13-FERN", name: "EP13 Fern");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new AddWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 3
        };

        // Act
        var result = await service.AddWalkUpLineAsync(order.Id, request);

        // Assert
        result.PlantCatalogId.Should().Be(plant.Id);
        result.QtyOrdered.Should().Be(3);
        result.OrderId.Should().Be(order.Id);

        // Verify line was persisted
        var lines = await db.OrderLines.Where(l => l.OrderId == order.Id).ToListAsync();
        lines.Should().ContainSingle();
        lines[0].QtyOrdered.Should().Be(3);
        lines[0].PlantCatalogId.Should().Be(plant.Id);
    }

    [Fact]
    public async Task AddWalkUpLine_NonWalkUpOrder_ThrowsKeyNotFound()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new AddWalkUpLineRequest
        {
            PlantCatalogId = Guid.NewGuid(),
            QtyOrdered = 1
        };

        // Act & Assert
        var act = () => service.AddWalkUpLineAsync(order.Id, request);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Walk-up order not found*");
    }

    [Fact]
    public async Task AddWalkUpLine_ExceedsAvailability_ThrowsValidation()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP13-EXCEEDS", sku: "EP13-EXCEEDS");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, protectionMock, _) = CreateService(db);

        // Override protection mock to reject
        protectionMock
            .Setup(p => p.ValidateWalkupLineAsync(plant.Id, 50, It.IsAny<Guid?>()))
            .ReturnsAsync((false, 5, "Only 5 units available for walk-up orders."));

        var request = new AddWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 50
        };

        // Act & Assert
        var act = () => service.AddWalkUpLineAsync(order.Id, request);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Only 5 units available*");
    }

    [Fact]
    public async Task AddWalkUpLine_AdminOverride_AllowsExceedingAvailability()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP13-OVERRIDE", sku: "EP13-OVERRIDE");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, protectionMock, adminMock) = CreateService(db);

        // Protection would deny this
        protectionMock
            .Setup(p => p.ValidateWalkupLineAsync(plant.Id, 50, It.IsAny<Guid?>()))
            .ReturnsAsync((false, 5, "Only 5 units available."));

        var request = new AddWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 50
        };

        // Act: use admin override with correct PIN
        var result = await service.AddWalkUpLineAsync(order.Id, request, adminPin: "1234", adminReason: "Customer insists");

        // Assert: line was created despite exceeding availability
        result.QtyOrdered.Should().Be(50);

        // Assert: order was flagged with HasIssue
        var updatedOrder = await db.Orders.FindAsync(order.Id);
        updatedOrder!.HasIssue.Should().BeTrue();

        // Assert: admin action was logged
        adminMock.Verify(a => a.LogActionAsync(
            "WalkUpOverride",
            "OrderLine",
            It.IsAny<Guid>(),
            "Customer insists",
            It.IsAny<string?>()), Times.Once);
    }

    // --- EP-14: Update Walk-Up Order Line Tests ---

    [Fact]
    public async Task UpdateWalkUpLine_ValidRequest_UpdatesQuantity()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP14", sku: "EP14-DAISY", name: "EP14 Daisy");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new UpdateWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 5
        };

        // Act
        var result = await service.UpdateWalkUpLineAsync(order.Id, line.Id, request);

        // Assert
        result.QtyOrdered.Should().Be(5);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        updatedLine!.QtyOrdered.Should().Be(5);
    }

    [Fact]
    public async Task UpdateWalkUpLine_ReduceQuantity_Succeeds()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP14-REDUCE", sku: "EP14-REDUCE");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new UpdateWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 1
        };

        // Act
        var result = await service.UpdateWalkUpLineAsync(order.Id, line.Id, request);

        // Assert
        result.QtyOrdered.Should().Be(1);
    }

    [Fact]
    public async Task UpdateWalkUpLine_BelowFulfilled_ThrowsValidation()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP14-BELOW", sku: "EP14-BELOW");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 3);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new UpdateWalkUpLineRequest
        {
            PlantCatalogId = plant.Id,
            QtyOrdered = 2 // below QtyFulfilled of 3
        };

        // Act & Assert
        var act = () => service.UpdateWalkUpLineAsync(order.Id, line.Id, request);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Cannot reduce QtyOrdered below QtyFulfilled*");
    }

    [Fact]
    public async Task UpdateWalkUpLine_NonWalkUpOrder_ThrowsKeyNotFound()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new UpdateWalkUpLineRequest
        {
            PlantCatalogId = Guid.NewGuid(),
            QtyOrdered = 1
        };

        // Act & Assert
        var act = () => service.UpdateWalkUpLineAsync(order.Id, Guid.NewGuid(), request);
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*Walk-up order not found*");
    }

    [Fact]
    public async Task UpdateWalkUpLine_ChangePlantOnPartiallyFulfilled_ThrowsValidation()
    {
        // Arrange
        using var db = CreateDb();
        var plant1 = TestDataBuilder.CreatePlant(barcode: "BC-EP14-P1", sku: "EP14-P1");
        var plant2 = TestDataBuilder.CreatePlant(barcode: "BC-EP14-P2", sku: "EP14-P2");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant1.Id, qtyOrdered: 5, qtyFulfilled: 1);

        db.PlantCatalogs.AddRange(plant1, plant2);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);

        var request = new UpdateWalkUpLineRequest
        {
            PlantCatalogId = plant2.Id, // changing plant on partially fulfilled line
            QtyOrdered = 5
        };

        // Act & Assert
        var act = () => service.UpdateWalkUpLineAsync(order.Id, line.Id, request);
        await act.Should().ThrowAsync<FluentValidation.ValidationException>()
            .WithMessage("*Cannot change plant on a line that has been partially fulfilled*");
    }

    // --- EP-15: Get Walk-Up Availability Tests ---

    [Fact]
    public async Task GetAllAvailability_ReturnsCorrectDeduction()
    {
        // Arrange: test directly via InventoryProtectionService since
        // WalkUpService does not expose availability — the controller calls IInventoryProtectionService
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP15", sku: "EP15-TULIP", name: "EP15 Tulip");
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        var customer = TestDataBuilder.CreateCustomer("EP15 Customer");

        // Create a non-walk-up (preorder) order with 3 unfulfilled
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var protectionService = new InventoryProtectionService(db);

        // Act
        var availability = await protectionService.GetAllAvailabilityAsync();

        // Assert
        var plantAvail = availability.FirstOrDefault(a => a.PlantCatalogId == plant.Id);
        plantAvail.Should().NotBeNull();
        plantAvail!.OnHandQty.Should().Be(10);
        plantAvail.PreorderRemaining.Should().Be(3);
        plantAvail.AvailableForWalkup.Should().Be(7);
    }

    [Fact]
    public async Task GetAllAvailability_NoPreorders_AvailabilityEqualsOnHand()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP15-NOPRE", sku: "EP15-NOPRE", name: "No Preorder Plant");
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 20);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var protectionService = new InventoryProtectionService(db);

        // Act
        var availability = await protectionService.GetAllAvailabilityAsync();

        // Assert
        var plantAvail = availability.FirstOrDefault(a => a.PlantCatalogId == plant.Id);
        plantAvail.Should().NotBeNull();
        plantAvail!.OnHandQty.Should().Be(20);
        plantAvail.PreorderRemaining.Should().Be(0);
        plantAvail.AvailableForWalkup.Should().Be(20);
    }

    [Fact]
    public async Task GetAllAvailability_PreorderExceedsOnHand_AvailabilityIsZero()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP15-EXCEED", sku: "EP15-EXCEED", name: "Exceeded Plant");
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 2);
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var protectionService = new InventoryProtectionService(db);

        // Act
        var availability = await protectionService.GetAllAvailabilityAsync();

        // Assert: availability should be 0 (clamped), not negative
        var plantAvail = availability.FirstOrDefault(a => a.PlantCatalogId == plant.Id);
        plantAvail.Should().NotBeNull();
        plantAvail!.OnHandQty.Should().Be(2);
        plantAvail.PreorderRemaining.Should().Be(5);
        plantAvail.AvailableForWalkup.Should().Be(0);
    }

    [Fact]
    public async Task GetAllAvailability_PartiallyFulfilledPreorder_CalculatesCorrectly()
    {
        // Arrange: preorder of 5, fulfilled 2 => remaining = 3, onHand = 10 => available = 7
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP15-PARTIAL", sku: "EP15-PARTIAL", name: "Partial Plant");
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress, isWalkUp: false);
        var preorderLine = TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(preorderLine);
        await db.SaveChangesAsync();

        var protectionService = new InventoryProtectionService(db);

        // Act
        var availability = await protectionService.GetAllAvailabilityAsync();

        // Assert
        var plantAvail = availability.FirstOrDefault(a => a.PlantCatalogId == plant.Id);
        plantAvail.Should().NotBeNull();
        plantAvail!.OnHandQty.Should().Be(10);
        plantAvail.PreorderRemaining.Should().Be(3); // 5 - 2
        plantAvail.AvailableForWalkup.Should().Be(7); // 10 - 3
    }

    [Fact]
    public async Task GetAllAvailability_WalkUpOrdersNotDeducted()
    {
        // Arrange: walk-up orders should NOT count as preorder deductions
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP15-WU", sku: "EP15-WU", name: "WalkUp Test Plant");
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        var customer = TestDataBuilder.CreateCustomer();

        // Walk-up order with unfulfilled qty
        var walkupOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        var walkupLine = TestDataBuilder.CreateOrderLine(walkupOrder.Id, plant.Id, qtyOrdered: 4, qtyFulfilled: 0);

        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inventory);
        db.Customers.Add(customer);
        db.Orders.Add(walkupOrder);
        db.OrderLines.Add(walkupLine);
        await db.SaveChangesAsync();

        var protectionService = new InventoryProtectionService(db);

        // Act
        var availability = await protectionService.GetAllAvailabilityAsync();

        // Assert: walk-up orders should not reduce availability
        var plantAvail = availability.FirstOrDefault(a => a.PlantCatalogId == plant.Id);
        plantAvail.Should().NotBeNull();
        plantAvail!.OnHandQty.Should().Be(10);
        plantAvail.PreorderRemaining.Should().Be(0);
        plantAvail.AvailableForWalkup.Should().Be(10);
    }
}
