using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Moq;
using HamptonHawksPlantSales.Core.Interfaces;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

public class AdminServiceTests
{
    [Fact]
    public async Task LogActionAsync_CreatesAdminAction()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new AdminService(db);
        var entityId = Guid.NewGuid();

        // Act
        var result = await service.LogActionAsync("ForceComplete", "Order", entityId, "Testing", "Test message");

        // Assert
        result.Should().NotBeNull();
        result.ActionType.Should().Be("ForceComplete");
        result.EntityType.Should().Be("Order");
        result.EntityId.Should().Be(entityId);
        result.Reason.Should().Be("Testing");
        result.Message.Should().Be("Test message");

        var saved = await db.AdminActions.FirstOrDefaultAsync(a => a.EntityId == entityId);
        saved.Should().NotBeNull();
    }

    [Fact]
    public async Task IsSaleClosedAsync_WhenOpen_ReturnsFalse()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var settings = TestDataBuilder.CreateAppSettings(saleClosed: false);
        // Remove seeded row first
        var existing = await db.AppSettings.FirstOrDefaultAsync();
        if (existing != null) db.AppSettings.Remove(existing);
        db.AppSettings.Add(settings);
        await db.SaveChangesAsync();

        var service = new AdminService(db);

        // Act
        var result = await service.IsSaleClosedAsync();

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsSaleClosedAsync_WhenClosed_ReturnsTrue()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var existing = await db.AppSettings.FirstOrDefaultAsync();
        if (existing != null) db.AppSettings.Remove(existing);
        var settings = TestDataBuilder.CreateAppSettings(saleClosed: true);
        db.AppSettings.Add(settings);
        await db.SaveChangesAsync();

        var service = new AdminService(db);

        // Act
        var result = await service.IsSaleClosedAsync();

        // Assert
        result.Should().BeTrue();
    }


    [Fact]
    public async Task GetActionsAsync_OrderIdFilter_OnlyReturnsOrderEntityType()
    {
        using var db = MockDbContextFactory.Create();
        var service = new AdminService(db);
        var orderId = Guid.NewGuid();

        await service.LogActionAsync("ForceComplete", "Order", orderId, "Order reason");
        await service.LogActionAsync("InventoryAdjust", "Plant", orderId, "Plant reason");

        var actions = await service.GetActionsAsync(orderId, null, null);

        actions.Should().HaveCount(1);
        actions[0].EntityType.Should().Be("Order");
        actions[0].EntityId.Should().Be(orderId);
    }

    [Fact]
    public async Task GetActionsAsync_ReturnsNewestFirst()
    {
        using var db = MockDbContextFactory.Create();
        var service = new AdminService(db);

        var first = await service.LogActionAsync("First", "Order", Guid.NewGuid(), "one");
        await Task.Delay(5);
        var second = await service.LogActionAsync("Second", "Order", Guid.NewGuid(), "two");

        var actions = await service.GetActionsAsync(null, null, null);

        actions.Should().HaveCount(2);
        actions[0].Id.Should().Be(second.Id);
        actions[1].Id.Should().Be(first.Id);
    }

    [Fact]
    public async Task ForceComplete_WithPin_CompletesOrderWithUnfulfilledLines()
    {
        // This tests the full ForceComplete flow through FulfillmentService
        // which delegates to AdminService.LogActionAsync
        using var db = MockDbContextFactory.Create();
        var adminService = new AdminService(db);

        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var plant = TestDataBuilder.CreatePlant();
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 10, qtyFulfilled: 3);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var fulfillmentService = new FulfillmentService(db, adminService);

        // Act
        var result = await fulfillmentService.ForceCompleteOrderAsync(order.Id, "Customer left early", "tester");

        // Assert
        result.Should().BeTrue();

        var updatedOrder = await db.Orders.FindAsync(order.Id);
        updatedOrder!.Status.Should().Be(OrderStatus.Complete);

        // Verify unfulfilled line still has remaining qty
        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        updatedLine!.QtyFulfilled.Should().Be(3);
        updatedLine.QtyOrdered.Should().Be(10);
    }

    [Fact]
    public async Task ForceComplete_RecordsAdminAction()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var adminService = new AdminService(db);

        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var fulfillmentService = new FulfillmentService(db, adminService);

        // Act
        await fulfillmentService.ForceCompleteOrderAsync(order.Id, "Customer left early", "tester");

        // Assert
        var adminAction = await db.AdminActions
            .FirstOrDefaultAsync(a => a.EntityId == order.Id && a.ActionType == "ForceComplete");
        adminAction.Should().NotBeNull();
        adminAction!.EntityType.Should().Be("Order");
        adminAction.Reason.Should().Be("Customer left early");
        adminAction.Message.Should().Contain("force-completed");
    }
}
