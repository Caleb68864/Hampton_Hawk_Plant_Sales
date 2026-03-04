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
        var result = await service.UndoLastScanAsync(orderId, "test", "tester");

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

        var result = await service.UndoLastScanAsync(order.Id, "test", "tester");

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
        var result = await service.ForceCompleteOrderAsync(order.Id, "Closing out remaining", "tester");

        // Assert
        result.Should().BeTrue();
        var updated = await db.Orders.FindAsync(order.Id);
        updated!.Status.Should().Be(OrderStatus.Complete);
    }


    [Fact]
    public async Task ManualFulfill_SucceedsAndWritesAuditEvent()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-MANUAL-SUCCESS", sku: "SKU-MANUAL-SUCCESS");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 4);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, adminMock) = CreateService(db);

        var result = await service.ManualFulfillAsync(order.Id, new HamptonHawksPlantSales.Core.DTOs.ManualFulfillRequest
        {
            OrderLineId = line.Id,
            Reason = "Label missing",
            OperatorName = "Pickup Operator"
        });

        result.Result.Should().Be(FulfillmentResult.Accepted);
        result.Line!.QtyFulfilled.Should().Be(1);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        var updatedInventory = await db.Inventories.FindAsync(inventory.Id);
        updatedLine!.QtyFulfilled.Should().Be(1);
        updatedInventory!.OnHandQty.Should().Be(3);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Result.Should().Be(FulfillmentResult.Accepted);
        evt.Message.Should().Contain("MANUAL FULFILL");
        evt.Message.Should().Contain("Label missing");

        adminMock.Verify(a => a.LogActionAsync(
            "ManualFulfill",
            "Order",
            order.Id,
            "Label missing",
            It.Is<string>(m => m.Contains("Pickup Operator"))),
            Times.Once);
    }

    [Fact]
    public async Task ManualFulfill_InvalidLineForOrder_ThrowsValidationException()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-MANUAL-INVALID");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var otherOrder = TestDataBuilder.CreateOrder(customer.Id);
        var otherLine = TestDataBuilder.CreateOrderLine(otherOrder.Id, plant.Id, qtyOrdered: 1, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 2);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.AddRange(order, otherOrder);
        db.OrderLines.Add(otherLine);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var act = () => service.ManualFulfillAsync(order.Id, new HamptonHawksPlantSales.Core.DTOs.ManualFulfillRequest
        {
            OrderLineId = otherLine.Id,
            Reason = "Wrong order test",
            OperatorName = "Pickup Operator"
        });

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*does not belong to this order*");
    }

    [Fact]
    public async Task ManualFulfill_WhenSaleClosed_ReturnsSaleClosedBlocked()
    {
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db, saleClosed: true);

        var result = await service.ManualFulfillAsync(order.Id, new HamptonHawksPlantSales.Core.DTOs.ManualFulfillRequest
        {
            OrderLineId = Guid.NewGuid(),
            Reason = "Sale closed test",
            OperatorName = "Pickup Operator"
        });

        result.Result.Should().Be(FulfillmentResult.SaleClosedBlocked);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Result.Should().Be(FulfillmentResult.SaleClosedBlocked);
        evt.Message.Should().Contain("Sales are currently closed");
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
        var result = await service.ResetOrderAsync(order.Id, "Need to add more items", "tester");

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

        // Assert - should be OutOfStock since no inventory record exists
        result.Result.Should().Be(FulfillmentResult.OutOfStock);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstAsync();
        evt.Message.Should().Contain("What happened:");
        evt.Message.Should().Contain("What to do next:");
        evt.Message.Should().Contain("could not be reserved for fulfillment");

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

    // --- EP-07: Undo Last Scan Tests ---

    [Fact]
    public async Task UndoLastScan_RestoresInventoryAndFulfillment()
    {
        // Arrange: set up plant, inventory, customer, order, and order line
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "TEST-001", sku: "SKU-UNDO-001");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act: perform a scan first to create an Accepted event
        var scanResult = await service.ScanAsync(order.Id, "TEST-001");
        scanResult.Result.Should().Be(FulfillmentResult.Accepted);

        // Verify the scan took effect
        var lineAfterScan = await db.OrderLines.FindAsync(line.Id);
        lineAfterScan!.QtyFulfilled.Should().Be(1);
        var inventoryAfterScan = await db.Inventories.FindAsync(inventory.Id);
        inventoryAfterScan!.OnHandQty.Should().Be(9);

        // Act: undo the last scan
        var undoResult = await service.UndoLastScanAsync(order.Id, "testing undo", "test-operator");

        // Assert: undo succeeded
        undoResult.Result.Should().Be(FulfillmentResult.Accepted);
        undoResult.OrderId.Should().Be(order.Id);

        // Assert: inventory restored to 10
        var inventoryAfterUndo = await db.Inventories.FindAsync(inventory.Id);
        inventoryAfterUndo!.OnHandQty.Should().Be(10);

        // Assert: QtyFulfilled decremented back to 0
        var lineAfterUndo = await db.OrderLines.FindAsync(line.Id);
        lineAfterUndo!.QtyFulfilled.Should().Be(0);

        // Assert: original Accepted event is soft-deleted
        var originalEvent = await db.FulfillmentEvents
            .IgnoreQueryFilters()
            .Where(e => e.OrderId == order.Id && e.Result == FulfillmentResult.Accepted && e.DeletedAt != null)
            .FirstOrDefaultAsync();
        originalEvent.Should().NotBeNull();

        // Assert: a new undo FulfillmentEvent was created
        var undoEvent = await db.FulfillmentEvents
            .Where(e => e.OrderId == order.Id && e.Result == FulfillmentResult.Accepted && e.DeletedAt == null)
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync();
        undoEvent.Should().NotBeNull();
        undoEvent!.Message.Should().Contain("UNDO");
    }

    [Fact]
    public async Task UndoLastScan_NoAcceptedEvent_ThrowsKeyNotFound()
    {
        // Arrange: order with no prior scan events
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act & Assert
        var act = () => service.UndoLastScanAsync(order.Id, "no scans", "tester");
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage("*No accepted scan found to undo*");
    }

    [Fact]
    public async Task UndoLastScan_SoftDeletesOriginalEvent()
    {
        // Arrange
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-UNDO-SD", sku: "SKU-UNDO-SD");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Scan to create an accepted event
        await service.ScanAsync(order.Id, "BC-UNDO-SD");

        // Capture the accepted event ID before undo
        var acceptedBefore = await db.FulfillmentEvents
            .Where(e => e.OrderId == order.Id && e.Result == FulfillmentResult.Accepted && e.DeletedAt == null)
            .FirstAsync();
        var acceptedEventId = acceptedBefore.Id;

        // Undo the scan
        await service.UndoLastScanAsync(order.Id, "undo test", "tester");

        // The original event should now be soft-deleted
        var softDeleted = await db.FulfillmentEvents
            .IgnoreQueryFilters()
            .FirstAsync(e => e.Id == acceptedEventId);
        softDeleted.DeletedAt.Should().NotBeNull();

        // A new undo event should exist (not soft-deleted)
        var activeEvents = await db.FulfillmentEvents
            .Where(e => e.OrderId == order.Id && e.DeletedAt == null)
            .ToListAsync();
        activeEvents.Should().ContainSingle();
        activeEvents[0].Message.Should().Contain("UNDO");
    }

    // --- EP-11: Get Fulfillment Events Tests ---

    [Fact]
    public async Task GetEvents_ReturnsFulfillmentEventsForOrder()
    {
        // Arrange: create events directly in the DB to avoid needing relational scan path
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EVT-11", sku: "SKU-EVT-11");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        // Save events in separate calls so SaveChangesAsync assigns distinct CreatedAt values
        db.FulfillmentEvents.Add(new FulfillmentEvent
        {
            OrderId = order.Id,
            PlantCatalogId = plant.Id,
            Barcode = "BC-EVT-11",
            Result = FulfillmentResult.Accepted,
            Message = "Scanned 1x test plant"
        });
        await db.SaveChangesAsync();
        await Task.Delay(15); // ensure distinct timestamp

        db.FulfillmentEvents.Add(new FulfillmentEvent
        {
            OrderId = order.Id,
            PlantCatalogId = plant.Id,
            Barcode = "BC-EVT-11",
            Result = FulfillmentResult.Accepted,
            Message = "Scanned 2x test plant"
        });
        await db.SaveChangesAsync();
        await Task.Delay(15);

        db.FulfillmentEvents.Add(new FulfillmentEvent
        {
            OrderId = order.Id,
            PlantCatalogId = null,
            Barcode = "NONEXISTENT-999",
            Result = FulfillmentResult.NotFound,
            Message = "Barcode not found"
        });
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var events = await service.GetEventsAsync(order.Id);

        // Assert: 3 events returned
        events.Should().HaveCount(3);

        // Assert: events sorted by CreatedAt descending (most recent first)
        events[0].CreatedAt.Should().BeOnOrAfter(events[1].CreatedAt);
        events[1].CreatedAt.Should().BeOnOrAfter(events[2].CreatedAt);

        // Assert: each event has orderId
        events.Should().OnlyContain(e => e.OrderId == order.Id);

        // Assert: first event (most recent) is NotFound
        events[0].Result.Should().Be(FulfillmentResult.NotFound);
        events[0].Barcode.Should().Be("NONEXISTENT-999");

        // Assert: second event is Accepted
        events[1].Result.Should().Be(FulfillmentResult.Accepted);
        events[1].Barcode.Should().Be("BC-EVT-11");

        // Assert: third event (oldest) is Accepted
        events[2].Result.Should().Be(FulfillmentResult.Accepted);
        events[2].Barcode.Should().Be("BC-EVT-11");
    }

    [Fact]
    public async Task GetEvents_ExcludesSoftDeletedEvents()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.Orders.Add(order);

        var activeEvent = new FulfillmentEvent
        {
            OrderId = order.Id,
            Barcode = "BC-ACTIVE",
            Result = FulfillmentResult.Accepted,
            Message = "Active event"
        };
        var deletedEvent = new FulfillmentEvent
        {
            OrderId = order.Id,
            Barcode = "BC-DELETED",
            Result = FulfillmentResult.Accepted,
            Message = "Deleted event",
            DeletedAt = DateTimeOffset.UtcNow
        };

        db.FulfillmentEvents.AddRange(activeEvent, deletedEvent);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var events = await service.GetEventsAsync(order.Id);

        // Assert: only the active event is returned
        events.Should().ContainSingle();
        events[0].Barcode.Should().Be("BC-ACTIVE");
    }

    [Fact]
    public async Task GetEvents_NoEventsForOrder_ReturnsEmptyList()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db);
        var orderId = Guid.NewGuid();

        // Act
        var events = await service.GetEventsAsync(orderId);

        // Assert
        events.Should().BeEmpty();
    }

    [Fact]
    public async Task GetEvents_ContainsExpectedFields()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-FIELDS", sku: "SKU-FIELDS");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);

        var evt = new FulfillmentEvent
        {
            OrderId = order.Id,
            PlantCatalogId = plant.Id,
            Barcode = "BC-FIELDS",
            Result = FulfillmentResult.Accepted,
            Message = "Test event with fields"
        };
        db.FulfillmentEvents.Add(evt);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        // Act
        var events = await service.GetEventsAsync(order.Id);

        // Assert: event contains all expected fields
        var returnedEvent = events.Single();
        returnedEvent.Id.Should().NotBe(Guid.Empty);
        returnedEvent.OrderId.Should().Be(order.Id);
        returnedEvent.PlantCatalogId.Should().Be(plant.Id);
        returnedEvent.Barcode.Should().Be("BC-FIELDS");
        returnedEvent.Result.Should().Be(FulfillmentResult.Accepted);
        returnedEvent.Message.Should().Be("Test event with fields");
        returnedEvent.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }
}
