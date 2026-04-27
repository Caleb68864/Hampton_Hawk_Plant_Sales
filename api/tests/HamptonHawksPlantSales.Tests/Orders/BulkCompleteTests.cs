using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Core.Validators;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Orders;

public class BulkCompleteTests
{
    private AppDbContext CreateDb() => MockDbContextFactory.Create();

    private (OrderService Service, Mock<IAdminService> AdminMock) CreateService(AppDbContext db)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var protectionMock = new Mock<IInventoryProtectionService>();
        var configMock = new Mock<IConfiguration>();

        var service = new OrderService(db, protectionMock.Object, adminMock.Object, configMock.Object);
        return (service, adminMock);
    }

    [Fact]
    public async Task BulkComplete_FullyFulfilledOrdersComplete_PartiallyFulfilledSkipped()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var orders = new List<Order>();
        var lines = new List<OrderLine>();

        // 3 fully fulfilled orders
        for (int i = 0; i < 3; i++)
        {
            var plant = TestDataBuilder.CreatePlant(barcode: $"BC-FULL-{i}", sku: $"SKU-FULL-{i}");
            db.PlantCatalogs.Add(plant);

            var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
            orders.Add(order);
            db.Orders.Add(order);

            var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 3);
            lines.Add(line);
            db.OrderLines.Add(line);
        }

        // 2 partially fulfilled orders
        for (int i = 0; i < 2; i++)
        {
            var plant = TestDataBuilder.CreatePlant(barcode: $"BC-PARTIAL-{i}", sku: $"SKU-PARTIAL-{i}");
            db.PlantCatalogs.Add(plant);

            var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
            orders.Add(order);
            db.Orders.Add(order);

            var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);
            lines.Add(line);
            db.OrderLines.Add(line);
        }

        await db.SaveChangesAsync();

        var (service, adminMock) = CreateService(db);

        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = orders.Select(o => o.Id).ToList()
        };

        // Act
        var result = await service.BulkCompleteAsync(request, "Test bulk complete");

        // Assert
        result.Outcomes.Should().HaveCount(5);

        var completed = result.Outcomes.Where(o => o.Outcome == "Completed").ToList();
        var skipped = result.Outcomes.Where(o => o.Outcome == "Skipped").ToList();

        completed.Should().HaveCount(3);
        skipped.Should().HaveCount(2);

        foreach (var skip in skipped)
        {
            skip.Reason.Should().Be("unfulfilled lines");
        }

        // Verify completed orders have status changed
        foreach (var outcome in completed)
        {
            var order = await db.Orders.FindAsync(outcome.OrderId);
            order!.Status.Should().Be(OrderStatus.Complete);
        }

        // Verify skipped orders remain InProgress
        foreach (var outcome in skipped)
        {
            var order = await db.Orders.FindAsync(outcome.OrderId);
            order!.Status.Should().Be(OrderStatus.InProgress);
        }

        // Verify admin logging was called for completed orders
        adminMock.Verify(a => a.LogActionAsync(
            "BulkComplete",
            "Order",
            It.IsAny<Guid>(),
            It.IsAny<string>(),
            It.Is<string>(m => m.Contains("bulk-complete"))),
            Times.Exactly(3));
    }

    [Fact]
    public async Task BulkComplete_OrderNotFound_ReturnsSkipped()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db);

        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() }
        };

        // Act
        var result = await service.BulkCompleteAsync(request, "Test");

        // Assert
        result.Outcomes.Should().HaveCount(2);
        result.Outcomes.Should().AllSatisfy(o =>
        {
            o.Outcome.Should().Be("Skipped");
            o.Reason.Should().Be("Order not found");
        });
    }

    [Fact]
    public async Task BulkComplete_MixedExistingAndNotFound_ReturnsCorrectOutcomes()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 2);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = new List<Guid> { order.Id, Guid.NewGuid() }
        };

        // Act
        var result = await service.BulkCompleteAsync(request, "Test");

        // Assert
        result.Outcomes.Should().HaveCount(2);

        var completed = result.Outcomes.First(o => o.OrderId == order.Id);
        completed.Outcome.Should().Be("Completed");

        var notFound = result.Outcomes.First(o => o.OrderId != order.Id);
        notFound.Outcome.Should().Be("Skipped");
        notFound.Reason.Should().Be("Order not found");
    }

    [Fact]
    public void BulkCompleteValidator_EmptyOrderIds_Fails()
    {
        // Arrange
        var validator = new BulkCompleteOrdersRequestValidator();
        var request = new BulkCompleteOrdersRequest { OrderIds = new List<Guid>() };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("required"));
    }

    [Fact]
    public void BulkCompleteValidator_Over500Items_Fails()
    {
        // Arrange
        var validator = new BulkCompleteOrdersRequestValidator();
        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = Enumerable.Range(0, 501).Select(_ => Guid.NewGuid()).ToList()
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("500"));
    }

    [Fact]
    public void BulkCompleteValidator_Under500Items_Passes()
    {
        // Arrange
        var validator = new BulkCompleteOrdersRequestValidator();
        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = Enumerable.Range(0, 500).Select(_ => Guid.NewGuid()).ToList()
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task BulkComplete_OrderWithNoLines_Completes()
    {
        // Arrange - order with no lines is technically "fully fulfilled" (vacuously true)
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var request = new BulkCompleteOrdersRequest
        {
            OrderIds = new List<Guid> { order.Id }
        };

        // Act
        var result = await service.BulkCompleteAsync(request, "Test");

        // Assert
        result.Outcomes.Should().ContainSingle();
        result.Outcomes[0].Outcome.Should().Be("Completed");

        var updatedOrder = await db.Orders.FindAsync(order.Id);
        updatedOrder!.Status.Should().Be(OrderStatus.Complete);
    }
}
