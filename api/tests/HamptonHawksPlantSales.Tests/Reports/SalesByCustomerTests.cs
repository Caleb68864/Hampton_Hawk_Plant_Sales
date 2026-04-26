using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Reports;

public class SalesByCustomerTests
{
    [Fact]
    public async Task GetSalesByCustomer_ReturnsAggregatedRows()
    {
        using var db = MockDbContextFactory.Create();

        var customerA = TestDataBuilder.CreateCustomer("Anders");
        var customerB = TestDataBuilder.CreateCustomer("Beale");
        var plant = TestDataBuilder.CreatePlant(name: "Fern", sku: "FERN", barcode: "BC-FERN");
        plant.Price = 4m;

        db.Customers.AddRange(customerA, customerB);
        db.PlantCatalogs.Add(plant);

        var aOrder1 = TestDataBuilder.CreateOrder(customerA.Id, OrderStatus.Open);
        aOrder1.OrderNumber = "CA-1";
        var aOrder2 = TestDataBuilder.CreateOrder(customerA.Id, OrderStatus.Complete);
        aOrder2.OrderNumber = "CA-2";
        var bOrder1 = TestDataBuilder.CreateOrder(customerB.Id, OrderStatus.Open);
        bOrder1.OrderNumber = "CB-1";

        db.Orders.AddRange(aOrder1, aOrder2, bOrder1);

        // Customer A: 3 ordered=10/4=40, fulfilled=4/4=16
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(aOrder1.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(aOrder1.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(aOrder2.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 3)
        );
        // Customer B: 1 line, 4 ordered, 4 fulfilled
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(bOrder1.Id, plant.Id, qtyOrdered: 4, qtyFulfilled: 4));

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesByCustomerAsync();

        rows.Should().HaveCount(2);

        var rowA = rows.First(r => r.CustomerId == customerA.Id);
        rowA.CustomerDisplayName.Should().Be("Anders");
        rowA.OrderCount.Should().Be(2);
        rowA.ItemsOrdered.Should().Be(10);
        rowA.ItemsFulfilled.Should().Be(4);
        rowA.RevenueOrdered.Should().Be(40m);
        rowA.RevenueFulfilled.Should().Be(16m);

        var rowB = rows.First(r => r.CustomerId == customerB.Id);
        rowB.OrderCount.Should().Be(1);
        rowB.ItemsOrdered.Should().Be(4);
        rowB.ItemsFulfilled.Should().Be(4);
        rowB.RevenueOrdered.Should().Be(16m);
        rowB.RevenueFulfilled.Should().Be(16m);
    }

    [Fact]
    public async Task GetSalesByCustomer_CustomerWithNoOrders_ReturnsZeroRow()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("No Orders");
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesByCustomerAsync();

        rows.Should().HaveCount(1);
        var row = rows[0];
        row.CustomerId.Should().Be(customer.Id);
        row.OrderCount.Should().Be(0);
        row.ItemsOrdered.Should().Be(0);
        row.ItemsFulfilled.Should().Be(0);
        row.RevenueOrdered.Should().Be(0m);
        row.RevenueFulfilled.Should().Be(0m);
    }

    [Fact]
    public async Task GetSalesByCustomer_NullPlantPrice_TreatsRevenueAsZero()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("Free Plants");
        var plant = TestDataBuilder.CreatePlant(name: "Mystery", sku: "MYST", barcode: "BC-MYST");
        plant.Price = null;
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        order.OrderNumber = "FREE-1";
        db.Orders.Add(order);
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2));

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesByCustomerAsync();

        rows.Should().HaveCount(1);
        var row = rows[0];
        row.OrderCount.Should().Be(1);
        row.ItemsOrdered.Should().Be(5);
        row.ItemsFulfilled.Should().Be(2);
        row.RevenueOrdered.Should().Be(0m);
        row.RevenueFulfilled.Should().Be(0m);
    }
}
