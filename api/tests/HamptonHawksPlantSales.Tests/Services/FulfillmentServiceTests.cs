using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Moq;
using Microsoft.EntityFrameworkCore;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Infrastructure.Services;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

public class FulfillmentServiceTests
{
    private AppDbContext CreateDb() => MockDbContextFactory.Create();

    private (FulfillmentService Service, Mock<IAdminService> AdminMock) CreateService(AppDbContext db, bool saleClosed = false)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(saleClosed);
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var service = new FulfillmentService(db, adminMock.Object);
        return (service, adminMock);
    }

    // --- SaleClosed Blocks Tests ---

    [Fact]
    public async Task Scan_WhenSaleClosed_ReturnsSaleClosedBlocked()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db, saleClosed: true);
        var orderId = Guid.NewGuid();

        // Act
        var result = await service.ScanAsync(orderId, "SOME-BARCODE");

        // Assert
        result.Result.Should().Be(FulfillmentResult.SaleClosedBlocked);
        result.OrderId.Should().Be(orderId);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("Sales are currently closed");
    }

    [Fact]
    public async Task UndoLastScan_WhenSaleClosed_ReturnsSaleClosedBlocked()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db, saleClosed: true);
        var orderId = Guid.NewGuid();

        // Act
        var result = await service.UndoLastScanAsync(orderId);

        // Assert
        result.Result.Should().Be(FulfillmentResult.SaleClosedBlocked);
        result.OrderId.Should().Be(orderId);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("Sales are currently closed");
    }


    [Fact]
    public async Task UndoLastScan_WhenSaleClosed_DoesNotModifyInventoryOrFulfillment()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-UNDO-CLOSED");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 1);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 9);
        var acceptedEvent = new FulfillmentEvent
        {
            OrderId = order.Id,
            PlantCatalogId = plant.Id,
            Barcode = plant.Barcode,
            Result = FulfillmentResult.Accepted,
            Message = "seed accepted event"
        };

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        db.FulfillmentEvents.Add(acceptedEvent);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db, saleClosed: true);

        var result = await service.UndoLastScanAsync(order.Id);

        result.Result.Should().Be(FulfillmentResult.SaleClosedBlocked);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        var updatedInventory = await db.Inventories.FindAsync(inventory.Id);
        updatedLine!.QtyFulfilled.Should().Be(1);
        updatedInventory!.OnHandQty.Should().Be(9);

        var activeAcceptedEvents = await db.FulfillmentEvents
            .Where(e => e.OrderId == order.Id && e.Result == FulfillmentResult.Accepted && e.DeletedAt == null)
            .CountAsync();
        activeAcceptedEvents.Should().Be(1);
    }

    [Fact]
    public async Task ForceCompleteOrder_WhenSaleClosed_StillSucceeds()
    {
        // ForceComplete does not check SaleClosed (admin override).
        // This test verifies the force complete path works.
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, adminMock) = CreateService(db, saleClosed: true);

        // Act
        var result = await service.ForceCompleteOrderAsync(order.Id, "Closing out remaining");

        // Assert
        result.Should().BeTrue();
        var updated = await db.Orders.FindAsync(order.Id);
        updated!.Status.Should().Be(OrderStatus.Complete);
    }

    // --- Wrong Order / Not Found / Already Fulfilled Tests ---

    [Fact]
    public async Task Scan_BarcodeNotFound_ReturnsNotFound()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db);
        var orderId = Guid.NewGuid();

        // Act
        var result = await service.ScanAsync(orderId, "NONEXISTENT-BARCODE");

        // Assert
        result.Result.Should().Be(FulfillmentResult.NotFound);
    }

    [Fact]
    public async Task Scan_BarcodeNotOnOrder_ReturnsWrongOrder()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-WRONG");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        // No order line linking order to this plant

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.ScanAsync(order.Id, "BC-WRONG");

        // Assert
        result.Result.Should().Be(FulfillmentResult.WrongOrder);
        result.Plant.Should().NotBeNull();
        result.Plant!.Name.Should().Be(plant.Name);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("does not belong to the selected order");
    }

    [Fact]
    public async Task Scan_SkuNotOnOrder_ReturnsWrongOrder()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-WRONG-SKU", sku: "SKU-WRONG");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        // No order line linking order to this plant

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.ScanAsync(order.Id, "SKU-WRONG");

        // Assert
        result.Result.Should().Be(FulfillmentResult.WrongOrder);
        result.Plant.Should().NotBeNull();
        result.Plant!.Sku.Should().Be("SKU-WRONG");
    }

    [Fact]
    public async Task Scan_AlreadyFulfilled_ReturnsAlreadyFulfilled()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-FULL");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 3);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.ScanAsync(order.Id, "BC-FULL");

        // Assert
        result.Result.Should().Be(FulfillmentResult.AlreadyFulfilled);
        result.Line.Should().NotBeNull();
        result.Line!.QtyFulfilled.Should().Be(3);
        result.Line!.QtyOrdered.Should().Be(3);
    }

    [Fact]
    public async Task Scan_OutOfStock_ReturnsOutOfStock()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-OOS");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 0);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.ScanAsync(order.Id, "BC-OOS");

        // Assert
        result.Result.Should().Be(FulfillmentResult.OutOfStock);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("out of stock");
    }

    // --- Scan Accepted Tests ---
    // Note: The Accepted path in ScanAsync uses FromSqlRaw with FOR UPDATE (row locking),
    // which is not supported by InMemory provider. We test this via ForceComplete + events.

    [Fact]
    public async Task CompleteOrder_AllFulfilled_Succeeds()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 3);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.CompleteOrderAsync(order.Id);

        // Assert
        result.Should().BeTrue();
        var updated = await db.Orders.FindAsync(order.Id);
        updated!.Status.Should().Be(OrderStatus.Complete);
    }

    [Fact]
    public async Task CompleteOrder_NotAllFulfilled_ThrowsValidation()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var act = async () => await service.CompleteOrderAsync(order.Id);

        // Assert
        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task ResetOrder_CompletedOrder_ResetsToInProgress()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, adminMock) = CreateService(db);

        // Act
        var result = await service.ResetOrderAsync(order.Id, "Need to add more items");

        // Assert
        result.Should().BeTrue();
        var updated = await db.Orders.FindAsync(order.Id);
        updated!.Status.Should().Be(OrderStatus.InProgress);
        adminMock.Verify(a => a.LogActionAsync("ResetOrder", "Order", order.Id, It.IsAny<string>(), It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task Scan_ValidBarcode_CreatesEventBeforeTransaction()
    {
        // This test verifies that when inventory exists but has 0 stock,
        // a FulfillmentEvent is created with OutOfStock result.
        // (Testing the Accepted path requires Postgres due to FOR UPDATE.)
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EVT");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);
        // No inventory record at all
        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var result = await service.ScanAsync(order.Id, "BC-EVT");

        // Assert - should be OutOfStock since no inventory
        result.Result.Should().Be(FulfillmentResult.OutOfStock);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("out of stock");

        // Verify a FulfillmentEvent was recorded
        var events = db.FulfillmentEvents.Where(e => e.OrderId == order.Id).ToList();
        events.Should().HaveCount(1);
        events[0].Result.Should().Be(FulfillmentResult.OutOfStock);
    }

    [Fact]
    public async Task Scan_SaleClosedBlocked_CreatesFulfillmentEvent()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db, saleClosed: true);
        var orderId = Guid.NewGuid();

        // Act
        await service.ScanAsync(orderId, "ANY-BARCODE");

        // Assert
        var events = db.FulfillmentEvents.Where(e => e.OrderId == orderId).ToList();
        events.Should().HaveCount(1);
        events[0].Result.Should().Be(FulfillmentResult.SaleClosedBlocked);
    }
}
