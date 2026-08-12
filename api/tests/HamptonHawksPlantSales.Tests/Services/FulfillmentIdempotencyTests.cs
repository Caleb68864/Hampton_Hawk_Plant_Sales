using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// A scan submitted twice with the same client scan id is one fulfillment, not two.
/// This is the double-tap case: a volunteer taps scan, the request stalls on a flaky
/// field LAN, and they tap again. Both requests can reach the server and each is a
/// legitimate scan as far as the locking layer is concerned, so dedupe has to be
/// explicit.
/// </summary>
public class FulfillmentIdempotencyTests
{
    private AppDbContext CreateDb() => MockDbContextFactory.Create();

    private FulfillmentService CreateService(AppDbContext db)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        return new FulfillmentService(db, adminMock.Object);
    }

    private async Task<(Order Order, PlantCatalog Plant, OrderLine Line, Inventory Inventory)> SeedAsync(
        AppDbContext db, int qtyOrdered = 3, int onHandQty = 10)
    {
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-IDEM", sku: "SKU-IDEM");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: qtyOrdered, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: onHandQty);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        return (order, plant, line, inventory);
    }

    [Fact]
    public async Task Scan_RepeatedWithSameScanId_FulfillsOnlyOnce()
    {
        using var db = CreateDb();
        var (order, plant, line, inventory) = await SeedAsync(db);
        var service = CreateService(db);
        var scanId = "scan-abc-123";

        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: scanId);
        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: scanId);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        var updatedInventory = await db.Inventories.FindAsync(inventory.Id);

        updatedLine!.QtyFulfilled.Should().Be(1, "the retry is the same scan, not a second one");
        updatedInventory!.OnHandQty.Should().Be(9);
    }

    [Fact]
    public async Task Scan_RepeatedWithSameScanId_ReplaysAcceptedOutcome()
    {
        using var db = CreateDb();
        var (order, plant, _, _) = await SeedAsync(db);
        var service = CreateService(db);
        var scanId = "scan-replay";

        var first = await service.ScanAsync(order.Id, plant.Barcode, quantity: 2, scanId: scanId);
        var replay = await service.ScanAsync(order.Id, plant.Barcode, quantity: 2, scanId: scanId);

        // The volunteer must see the same confirmation, not a confusing "already
        // fulfilled" that makes them think something went wrong.
        replay.Result.Should().Be(FulfillmentResult.Accepted);
        replay.Result.Should().Be(first.Result);
        replay.Plant!.Sku.Should().Be(plant.Sku);
        replay.Line!.QtyFulfilled.Should().Be(2);
        replay.OrderRemainingItems.Should().Be(first.OrderRemainingItems);
    }

    [Fact]
    public async Task Scan_RepeatedWithSameScanId_RecordsOnlyOneAcceptedEvent()
    {
        using var db = CreateDb();
        var (order, plant, _, _) = await SeedAsync(db);
        var service = CreateService(db);
        var scanId = "scan-single-event";

        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: scanId);
        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: scanId);

        var acceptedEvents = await db.FulfillmentEvents
            .Where(e => e.OrderId == order.Id && e.Result == FulfillmentResult.Accepted && e.DeletedAt == null)
            .CountAsync();

        acceptedEvents.Should().Be(1, "a replayed scan must not pollute the audit trail");
    }

    [Fact]
    public async Task Scan_WithDistinctScanIds_FulfillsEachTime()
    {
        using var db = CreateDb();
        var (order, plant, line, _) = await SeedAsync(db);
        var service = CreateService(db);

        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: "scan-1");
        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1, scanId: "scan-2");

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        updatedLine!.QtyFulfilled.Should().Be(2, "two deliberate scans are two fulfillments");
    }

    [Fact]
    public async Task Scan_WithoutScanId_KeepsLegacyRepeatBehavior()
    {
        using var db = CreateDb();
        var (order, plant, line, _) = await SeedAsync(db);
        var service = CreateService(db);

        // Older clients that do not send a scan id must keep working exactly as before.
        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1);
        await service.ScanAsync(order.Id, plant.Barcode, quantity: 1);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        updatedLine!.QtyFulfilled.Should().Be(2);
    }

    [Fact]
    public async Task Scan_SameScanIdOnDifferentOrders_IsNotTreatedAsReplay()
    {
        using var db = CreateDb();
        var (orderA, plant, lineA, _) = await SeedAsync(db);

        var customerB = TestDataBuilder.CreateCustomer();
        var orderB = TestDataBuilder.CreateOrder(customerB.Id);
        var lineB = TestDataBuilder.CreateOrderLine(orderB.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0);
        db.Customers.Add(customerB);
        db.Orders.Add(orderB);
        db.OrderLines.Add(lineB);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var scanId = "shared-scan-id";

        await service.ScanAsync(orderA.Id, plant.Barcode, quantity: 1, scanId: scanId);
        await service.ScanAsync(orderB.Id, plant.Barcode, quantity: 1, scanId: scanId);

        (await db.OrderLines.FindAsync(lineA.Id))!.QtyFulfilled.Should().Be(1);
        (await db.OrderLines.FindAsync(lineB.Id))!.QtyFulfilled.Should().Be(1, "dedupe is scoped per order");
    }
}
