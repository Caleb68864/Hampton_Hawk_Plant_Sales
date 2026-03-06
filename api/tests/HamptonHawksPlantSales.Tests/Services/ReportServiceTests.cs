using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Tests.Helpers;
using HamptonHawksPlantSales.Infrastructure.Services;

namespace HamptonHawksPlantSales.Tests.Services;

public class ReportServiceTests
{
    // ── EP-47: Dashboard metrics ──

    [Fact]
    public async Task GetDashboardMetrics_IncludesRequiredCounts()
    {
        using var db = MockDbContextFactory.Create();

        var customerA = TestDataBuilder.CreateCustomer("Customer A");
        var customerB = TestDataBuilder.CreateCustomer("Customer B");
        var customerDeleted = TestDataBuilder.CreateCustomer("Customer Deleted");
        customerDeleted.DeletedAt = DateTimeOffset.UtcNow;

        var sellerA = new HamptonHawksPlantSales.Core.Models.Seller { DisplayName = "Seller A" };
        var sellerDeleted = new HamptonHawksPlantSales.Core.Models.Seller { DisplayName = "Seller Deleted", DeletedAt = DateTimeOffset.UtcNow };

        var plantLow = TestDataBuilder.CreatePlant(sku: "LOW", barcode: "LOW-BC");
        var plantOk = TestDataBuilder.CreatePlant(sku: "OK", barcode: "OK-BC");

        var invLow = TestDataBuilder.CreateInventory(plantLow.Id, onHandQty: 2);
        var invOk = TestDataBuilder.CreateInventory(plantOk.Id, onHandQty: 10);

        var orderOpen = TestDataBuilder.CreateOrder(customerA.Id, OrderStatus.Open);
        var orderInProgress = TestDataBuilder.CreateOrder(customerA.Id, OrderStatus.InProgress);
        var orderComplete = TestDataBuilder.CreateOrder(customerB.Id, OrderStatus.Complete);
        orderComplete.HasIssue = true;

        db.Customers.AddRange(customerA, customerB, customerDeleted);
        db.Sellers.AddRange(sellerA, sellerDeleted);
        db.PlantCatalogs.AddRange(plantLow, plantOk);
        db.Inventories.AddRange(invLow, invOk);
        db.Orders.AddRange(orderOpen, orderInProgress, orderComplete);

        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(orderOpen.Id, plantLow.Id, qtyOrdered: 2, qtyFulfilled: 1));
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(orderInProgress.Id, plantOk.Id, qtyOrdered: 1, qtyFulfilled: 0));
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(orderComplete.Id, plantOk.Id, qtyOrdered: 3, qtyFulfilled: 3));

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var metrics = await service.GetDashboardMetricsAsync();

        Assert.Equal(3, metrics.TotalOrders);
        Assert.Equal(2, metrics.OpenOrders);
        Assert.Equal(1, metrics.CompletedOrders);
        Assert.Equal(2, metrics.TotalCustomers);
        Assert.Equal(1, metrics.TotalSellers);
        Assert.Equal(1, metrics.LowInventoryCount);
        Assert.Equal(1, metrics.ProblemOrderCount);

        Assert.Equal(6, metrics.TotalItemsOrdered);
        Assert.Equal(4, metrics.TotalItemsFulfilled);
        Assert.Equal(66.7, metrics.SaleProgressPercent);
    }

    // ── EP-48: Low inventory report ──

    [Fact]
    public async Task GetLowInventory_Threshold5_ReturnsOnlyLowAndEdge()
    {
        using var db = MockDbContextFactory.Create();

        var plantLow = TestDataBuilder.CreatePlant(name: "Low Rose", sku: "PLT-LOW", barcode: "BC-LOW");
        var plantEdge = TestDataBuilder.CreatePlant(name: "Edge Tulip", sku: "PLT-EDGE", barcode: "BC-EDGE");
        var plantHigh = TestDataBuilder.CreatePlant(name: "High Daisy", sku: "PLT-HIGH", barcode: "BC-HIGH");

        db.PlantCatalogs.AddRange(plantLow, plantEdge, plantHigh);
        db.Inventories.AddRange(
            TestDataBuilder.CreateInventory(plantLow.Id, onHandQty: 2),
            TestDataBuilder.CreateInventory(plantEdge.Id, onHandQty: 5),
            TestDataBuilder.CreateInventory(plantHigh.Id, onHandQty: 10)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetLowInventoryAsync(5);

        result.Should().HaveCount(2);
        result.Should().Contain(r => r.Sku == "PLT-LOW" && r.OnHandQty == 2);
        result.Should().Contain(r => r.Sku == "PLT-EDGE" && r.OnHandQty == 5);
        result.Should().NotContain(r => r.Sku == "PLT-HIGH");
    }

    [Fact]
    public async Task GetLowInventory_Threshold2_ReturnsOnlyLowest()
    {
        using var db = MockDbContextFactory.Create();

        var plantLow = TestDataBuilder.CreatePlant(name: "Low Rose", sku: "PLT-LOW2", barcode: "BC-LOW2");
        var plantEdge = TestDataBuilder.CreatePlant(name: "Edge Tulip", sku: "PLT-EDGE2", barcode: "BC-EDGE2");

        db.PlantCatalogs.AddRange(plantLow, plantEdge);
        db.Inventories.AddRange(
            TestDataBuilder.CreateInventory(plantLow.Id, onHandQty: 2),
            TestDataBuilder.CreateInventory(plantEdge.Id, onHandQty: 5)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetLowInventoryAsync(2);

        result.Should().HaveCount(1);
        result[0].Sku.Should().Be("PLT-LOW2");
        result[0].OnHandQty.Should().Be(2);
    }

    [Fact]
    public async Task GetLowInventory_ResponseContainsRequiredFields()
    {
        using var db = MockDbContextFactory.Create();

        var plant = TestDataBuilder.CreatePlant(name: "Test Plant", sku: "PLT-FIELDS", barcode: "BC-FIELDS");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 1));
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetLowInventoryAsync(5);

        result.Should().HaveCount(1);
        var item = result[0];
        item.PlantCatalogId.Should().NotBe(Guid.Empty);
        item.PlantName.Should().Be("Test Plant");
        item.Sku.Should().Be("PLT-FIELDS");
        item.OnHandQty.Should().Be(1);
    }

    // ── EP-49: Problem orders report ──

    [Fact]
    public async Task GetProblemOrders_ReturnsOnlyOrdersWithHasIssueTrue()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("Test Customer");
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-PROB", barcode: "BC-PROB");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var order1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        order1.OrderNumber = "ORD-001";
        order1.HasIssue = true;

        var order2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        order2.OrderNumber = "ORD-002";
        order2.HasIssue = false;

        var order3 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        order3.OrderNumber = "ORD-003";
        order3.HasIssue = true;

        var order4 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        order4.OrderNumber = "ORD-004";
        order4.HasIssue = false;

        db.Orders.AddRange(order1, order2, order3, order4);

        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(order1.Id, plant.Id, qtyOrdered: 2),
            TestDataBuilder.CreateOrderLine(order1.Id, plant.Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(order2.Id, plant.Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(order3.Id, plant.Id, qtyOrdered: 3),
            TestDataBuilder.CreateOrderLine(order3.Id, plant.Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(order3.Id, plant.Id, qtyOrdered: 2),
            TestDataBuilder.CreateOrderLine(order4.Id, plant.Id, qtyOrdered: 1)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetProblemOrdersAsync();

        result.Should().HaveCount(2);
        result.Should().Contain(r => r.OrderNumber == "ORD-001" && r.LineCount == 2);
        result.Should().Contain(r => r.OrderNumber == "ORD-003" && r.LineCount == 3);
        result.Should().NotContain(r => r.OrderNumber == "ORD-002");
        result.Should().NotContain(r => r.OrderNumber == "ORD-004");
    }

    [Fact]
    public async Task GetProblemOrders_ResponseContainsRequiredFields()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("Field Check");
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-PF", barcode: "BC-PF");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        order.OrderNumber = "ORD-FIELDS";
        order.HasIssue = true;
        db.Orders.Add(order);
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1));
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetProblemOrdersAsync();

        result.Should().HaveCount(1);
        var item = result[0];
        item.Id.Should().NotBe(Guid.Empty);
        item.OrderNumber.Should().Be("ORD-FIELDS");
        item.CustomerName.Should().Be("Field Check");
        item.Status.Should().Be(OrderStatus.Open);
        item.LineCount.Should().Be(1);
        item.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    // ── EP-50: Seller orders report ──

    [Fact]
    public async Task GetSellerOrders_ReturnsOnlyOrdersForTargetSeller()
    {
        using var db = MockDbContextFactory.Create();

        var sellerA = new Seller { DisplayName = "Seller A" };
        var sellerB = new Seller { DisplayName = "Seller B" };
        var customerX = TestDataBuilder.CreateCustomer("Customer X");
        var customerY = TestDataBuilder.CreateCustomer("Customer Y");
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-SO", barcode: "BC-SO");

        db.Sellers.AddRange(sellerA, sellerB);
        db.Customers.AddRange(customerX, customerY);
        db.PlantCatalogs.Add(plant);

        var order1 = TestDataBuilder.CreateOrder(customerX.Id, OrderStatus.Open);
        order1.SellerId = sellerA.Id;
        order1.OrderNumber = "ORD-S01";

        var order2 = TestDataBuilder.CreateOrder(customerY.Id, OrderStatus.Complete);
        order2.SellerId = sellerA.Id;
        order2.OrderNumber = "ORD-S02";

        var order3 = TestDataBuilder.CreateOrder(customerX.Id, OrderStatus.InProgress);
        order3.SellerId = sellerA.Id;
        order3.OrderNumber = "ORD-S03";
        order3.HasIssue = true;

        var order4 = TestDataBuilder.CreateOrder(customerY.Id, OrderStatus.Open);
        order4.SellerId = sellerB.Id;
        order4.OrderNumber = "ORD-S04";

        db.Orders.AddRange(order1, order2, order3, order4);

        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(order1.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(order1.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(order2.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 3),
            TestDataBuilder.CreateOrderLine(order3.Id, plant.Id, qtyOrdered: 4, qtyFulfilled: 2),
            TestDataBuilder.CreateOrderLine(order4.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetSellerOrdersAsync(sellerA.Id);

        result.Should().HaveCount(3);

        var o1 = result.First(r => r.OrderNumber == "ORD-S01");
        o1.CustomerName.Should().Be("Customer X");
        o1.TotalItemsOrdered.Should().Be(5);
        o1.TotalItemsFulfilled.Should().Be(0);

        var o2 = result.First(r => r.OrderNumber == "ORD-S02");
        o2.CustomerName.Should().Be("Customer Y");
        o2.Status.Should().Be(OrderStatus.Complete);
        o2.TotalItemsOrdered.Should().Be(3);
        o2.TotalItemsFulfilled.Should().Be(3);

        var o3 = result.First(r => r.OrderNumber == "ORD-S03");
        o3.HasIssue.Should().BeTrue();
        o3.TotalItemsOrdered.Should().Be(4);
        o3.TotalItemsFulfilled.Should().Be(2);

        result.Should().NotContain(r => r.OrderNumber == "ORD-S04");
    }

    [Fact]
    public async Task GetSellerOrders_ResponseContainsRequiredFields()
    {
        using var db = MockDbContextFactory.Create();

        var seller = new Seller { DisplayName = "Field Seller" };
        var customer = TestDataBuilder.CreateCustomer("Field Customer");
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-SF", barcode: "BC-SF");

        db.Sellers.Add(seller);
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        order.SellerId = seller.Id;
        order.OrderNumber = "ORD-SFIELDS";
        db.Orders.Add(order);
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 1));
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetSellerOrdersAsync(seller.Id);

        result.Should().HaveCount(1);
        var item = result[0];
        item.OrderId.Should().NotBe(Guid.Empty);
        item.OrderNumber.Should().Be("ORD-SFIELDS");
        item.CustomerName.Should().Be("Field Customer");
        item.Status.Should().Be(OrderStatus.Open);
        item.HasIssue.Should().BeFalse();
        item.TotalItemsOrdered.Should().Be(2);
        item.TotalItemsFulfilled.Should().Be(1);
        item.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }
}
