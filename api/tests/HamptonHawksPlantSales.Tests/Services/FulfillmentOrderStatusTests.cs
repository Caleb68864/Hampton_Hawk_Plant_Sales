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
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// A cancelled order's pick list is still lying on the table with a scannable
/// barcode. Scanning or manually fulfilling it must not take stock, and
/// completing a cancelled, draft, or empty order must be refused.
/// </summary>
public class FulfillmentOrderStatusTests
{
    private static FulfillmentService CreateService(AppDbContext db)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });
        return new FulfillmentService(db, adminMock.Object);
    }

    private static async Task<(Order Order, OrderLine Line, Inventory Inventory)> SeedOrder(
        AppDbContext db, OrderStatus status, string barcode, int qtyOrdered = 2)
    {
        var plant = TestDataBuilder.CreatePlant(barcode: barcode, sku: "SKU-" + barcode);
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, status);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: qtyOrdered, qtyFulfilled: 0);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();
        return (order, line, inventory);
    }

    [Theory]
    [InlineData(OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Complete)]
    [InlineData(OrderStatus.Draft)]
    public async Task Scan_OnOrderNotOpenOrInProgress_IsRejectedAndTakesNoStock(OrderStatus status)
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, inventory) = await SeedOrder(db, status, "BC-STATUS");
        var service = CreateService(db);

        var act = () => service.ScanAsync(order.Id, "BC-STATUS");

        await act.Should().ThrowAsync<ValidationException>().WithMessage($"Order is {status}*");
        (await db.Inventories.FindAsync(inventory.Id))!.OnHandQty.Should().Be(10);
        (await db.OrderLines.FindAsync(line.Id))!.QtyFulfilled.Should().Be(0);
    }

    [Theory]
    [InlineData(OrderStatus.Open)]
    [InlineData(OrderStatus.InProgress)]
    public async Task Scan_OnOpenOrInProgressOrder_StillAccepts(OrderStatus status)
    {
        using var db = MockDbContextFactory.Create();
        var (order, _, inventory) = await SeedOrder(db, status, "BC-OK");
        var service = CreateService(db);

        var result = await service.ScanAsync(order.Id, "BC-OK");

        result.Result.Should().Be(FulfillmentResult.Accepted);
        (await db.Inventories.FindAsync(inventory.Id))!.OnHandQty.Should().Be(9);
    }

    [Fact]
    public async Task ManualFulfill_OnCancelledOrder_IsRejectedAndTakesNoStock()
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, inventory) = await SeedOrder(db, OrderStatus.Cancelled, "BC-MANUAL");
        var service = CreateService(db);

        var act = () => service.ManualFulfillAsync(order.Id, new ManualFulfillRequest
        {
            OrderLineId = line.Id,
            Reason = "test",
            OperatorName = "vol"
        });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("Order is Cancelled*");
        (await db.Inventories.FindAsync(inventory.Id))!.OnHandQty.Should().Be(10);
    }

    [Theory]
    [InlineData(OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Draft)]
    public async Task CompleteOrder_OnCancelledOrDraft_IsRefused(OrderStatus status)
    {
        using var db = MockDbContextFactory.Create();
        var (order, line, _) = await SeedOrder(db, status, "BC-COMPLETE");
        line.QtyFulfilled = line.QtyOrdered;
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.CompleteOrderAsync(order.Id);

        await act.Should().ThrowAsync<ValidationException>().WithMessage($"*order is {status}*");
        (await db.Orders.FindAsync(order.Id))!.Status.Should().Be(status);
    }

    [Fact]
    public async Task CompleteOrder_WithNoLines_IsRefused()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var act = () => service.CompleteOrderAsync(order.Id);

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*no lines*");
        (await db.Orders.FindAsync(order.Id))!.Status.Should().Be(OrderStatus.Open);
    }
}
