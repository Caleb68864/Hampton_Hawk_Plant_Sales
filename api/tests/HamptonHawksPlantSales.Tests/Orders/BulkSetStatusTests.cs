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

public class BulkSetStatusTests
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
    public async Task BulkSetStatus_ChangesStatusForAllOrders()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var orders = new List<Order>();
        for (int i = 0; i < 5; i++)
        {
            var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
            orders.Add(order);
            db.Orders.Add(order);
        }

        await db.SaveChangesAsync();

        var (service, adminMock) = CreateService(db);

        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = orders.Select(o => o.Id).ToList(),
            TargetStatus = OrderStatus.Cancelled
        };

        // Act
        var result = await service.BulkSetStatusAsync(request, "Cancelling all orders");

        // Assert
        result.Outcomes.Should().HaveCount(5);
        result.Outcomes.Should().AllSatisfy(o =>
        {
            o.Outcome.Should().Be("StatusChanged");
            o.Reason.Should().BeNull();
        });

        // Verify all orders have status changed
        foreach (var order in orders)
        {
            var updated = await db.Orders.FindAsync(order.Id);
            updated!.Status.Should().Be(OrderStatus.Cancelled);
        }

        // Verify admin logging was called for each order
        adminMock.Verify(a => a.LogActionAsync(
            "BulkSetStatus",
            "Order",
            It.IsAny<Guid>(),
            It.IsAny<string>(),
            It.Is<string>(m => m.Contains("bulk-status"))),
            Times.Exactly(5));
    }

    [Fact]
    public async Task BulkSetStatus_OrderNotFound_ReturnsSkipped()
    {
        // Arrange
        using var db = CreateDb();
        var (service, _) = CreateService(db);

        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = new List<Guid> { Guid.NewGuid(), Guid.NewGuid() },
            TargetStatus = OrderStatus.InProgress
        };

        // Act
        var result = await service.BulkSetStatusAsync(request, "Test");

        // Assert
        result.Outcomes.Should().HaveCount(2);
        result.Outcomes.Should().AllSatisfy(o =>
        {
            o.Outcome.Should().Be("Skipped");
            o.Reason.Should().Be("Order not found");
        });
    }

    [Fact]
    public async Task BulkSetStatus_MixedExistingAndNotFound_ReturnsCorrectOutcomes()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);

        db.Customers.Add(customer);
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = new List<Guid> { order.Id, Guid.NewGuid() },
            TargetStatus = OrderStatus.InProgress
        };

        // Act
        var result = await service.BulkSetStatusAsync(request, "Test");

        // Assert
        result.Outcomes.Should().HaveCount(2);

        var changed = result.Outcomes.First(o => o.OrderId == order.Id);
        changed.Outcome.Should().Be("StatusChanged");

        var notFound = result.Outcomes.First(o => o.OrderId != order.Id);
        notFound.Outcome.Should().Be("Skipped");
        notFound.Reason.Should().Be("Order not found");
    }

    [Fact]
    public async Task BulkSetStatus_SetsToComplete_NoEligibilityCheck()
    {
        // Unlike BulkComplete, BulkSetStatus does not check eligibility
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant();
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 1); // partially fulfilled

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = new List<Guid> { order.Id },
            TargetStatus = OrderStatus.Complete
        };

        // Act
        var result = await service.BulkSetStatusAsync(request, "Force complete");

        // Assert
        result.Outcomes.Should().ContainSingle();
        result.Outcomes[0].Outcome.Should().Be("StatusChanged");

        var updated = await db.Orders.FindAsync(order.Id);
        updated!.Status.Should().Be(OrderStatus.Complete);
    }

    [Fact]
    public void BulkSetStatusValidator_EmptyOrderIds_Fails()
    {
        // Arrange
        var validator = new BulkSetOrderStatusRequestValidator();
        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = new List<Guid>(),
            TargetStatus = OrderStatus.Complete
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("required"));
    }

    [Fact]
    public void BulkSetStatusValidator_Over500Items_Fails()
    {
        // Arrange
        var validator = new BulkSetOrderStatusRequestValidator();
        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = Enumerable.Range(0, 501).Select(_ => Guid.NewGuid()).ToList(),
            TargetStatus = OrderStatus.Complete
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("500"));
    }

    [Fact]
    public void BulkSetStatusValidator_Under500Items_Passes()
    {
        // Arrange
        var validator = new BulkSetOrderStatusRequestValidator();
        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = Enumerable.Range(0, 500).Select(_ => Guid.NewGuid()).ToList(),
            TargetStatus = OrderStatus.InProgress
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void BulkSetStatusValidator_InvalidTargetStatus_Fails()
    {
        // Arrange
        var validator = new BulkSetOrderStatusRequestValidator();
        var request = new BulkSetOrderStatusRequest
        {
            OrderIds = new List<Guid> { Guid.NewGuid() },
            TargetStatus = (OrderStatus)999
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("valid OrderStatus"));
    }

    [Fact]
    public async Task BulkSetStatus_AllValidStatuses_Work()
    {
        // Arrange
        using var db = CreateDb();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var statuses = new[] { OrderStatus.Open, OrderStatus.InProgress, OrderStatus.Complete, OrderStatus.Cancelled };

        foreach (var targetStatus in statuses)
        {
            var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
            db.Orders.Add(order);
            await db.SaveChangesAsync();

            var (service, _) = CreateService(db);

            var request = new BulkSetOrderStatusRequest
            {
                OrderIds = new List<Guid> { order.Id },
                TargetStatus = targetStatus
            };

            // Act
            var result = await service.BulkSetStatusAsync(request, $"Set to {targetStatus}");

            // Assert
            result.Outcomes.Should().ContainSingle();
            result.Outcomes[0].Outcome.Should().Be("StatusChanged");

            var updated = await db.Orders.FindAsync(order.Id);
            updated!.Status.Should().Be(targetStatus);
        }
    }
}
