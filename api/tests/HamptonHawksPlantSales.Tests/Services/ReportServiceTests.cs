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

    // ── SS-02 (Wave 2): Daily sales ──

    [Fact]
    public async Task GetDailySales_EmptyDatabase_ReturnsEmptyDays()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetDailySalesAsync(null, null);

        result.Should().NotBeNull();
        result.Days.Should().BeEmpty();
    }

    [Fact]
    public async Task GetDailySales_HappyPath_GroupsByDateAndCountsItems()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("Daily Customer");
        var plant = TestDataBuilder.CreatePlant(sku: "DS", barcode: "BC-DS");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        // Two orders dated DAY_A — one walk-up ($50), one preorder ($30)
        var today1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        today1.AmountTendered = 50m;
        var today2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        today2.AmountTendered = 30m;
        // One order dated DAY_B — preorder ($20)
        var yesterday = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete, isWalkUp: false);
        yesterday.AmountTendered = 20m;
        // Draft — must be excluded
        var draft = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft);
        draft.AmountTendered = 999m;

        db.Orders.AddRange(today1, today2, yesterday, draft);
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(today1.Id, plant.Id, qtyOrdered: 3),
            TestDataBuilder.CreateOrderLine(today2.Id, plant.Id, qtyOrdered: 2),
            TestDataBuilder.CreateOrderLine(yesterday.Id, plant.Id, qtyOrdered: 4),
            TestDataBuilder.CreateOrderLine(draft.Id, plant.Id, qtyOrdered: 99)
        );
        await db.SaveChangesAsync();

        // AppDbContext.SaveChangesAsync stamps CreatedAt to UtcNow on insert,
        // so override AFTER the first save and persist again as Modified.
        var dayA = new DateTimeOffset(2026, 4, 26, 10, 0, 0, TimeSpan.Zero);
        var dayB = new DateTimeOffset(2026, 4, 25, 9, 0, 0, TimeSpan.Zero);
        today1.CreatedAt = dayA;
        today2.CreatedAt = dayA.AddHours(4);
        yesterday.CreatedAt = dayB;
        draft.CreatedAt = dayA.AddHours(1);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetDailySalesAsync(null, null);

        result.Days.Should().HaveCount(2);

        var day26 = result.Days.First(d => d.Date == new DateOnly(2026, 4, 26));
        day26.OrderCount.Should().Be(2);
        day26.ItemCount.Should().Be(5);
        day26.Revenue.Should().Be(80m);
        day26.WalkUpCount.Should().Be(1);
        day26.PreorderCount.Should().Be(1);

        var day25 = result.Days.First(d => d.Date == new DateOnly(2026, 4, 25));
        day25.OrderCount.Should().Be(1);
        day25.Revenue.Should().Be(20m);
    }

    // ── SS-02 (Wave 2): Payment breakdown ──

    [Fact]
    public async Task GetPaymentBreakdown_EmptyDatabase_ReturnsEmptyMethods()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetPaymentBreakdownAsync(null, null);

        result.Should().NotBeNull();
        result.Methods.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPaymentBreakdown_HappyPath_GroupsByMethodWithUnspecifiedFallback()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("PM Customer");
        db.Customers.Add(customer);

        var cash1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        cash1.PaymentMethod = "cash";
        cash1.AmountTendered = 40m;

        var cash2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        cash2.PaymentMethod = "cash";
        cash2.AmountTendered = 60m;

        var card = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        card.PaymentMethod = "card";
        card.AmountTendered = 100m;

        var nullPm = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        nullPm.PaymentMethod = null;
        nullPm.AmountTendered = null;

        var draft = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft);
        draft.PaymentMethod = "cash";
        draft.AmountTendered = 9999m;

        db.Orders.AddRange(cash1, cash2, card, nullPm, draft);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetPaymentBreakdownAsync(null, null);

        result.Methods.Should().HaveCount(3);
        var cashRow = result.Methods.First(m => m.Method == "cash");
        cashRow.OrderCount.Should().Be(2);
        cashRow.Revenue.Should().Be(100m);
        cashRow.AverageOrder.Should().Be(50m);

        var cardRow = result.Methods.First(m => m.Method == "card");
        cardRow.OrderCount.Should().Be(1);
        cardRow.Revenue.Should().Be(100m);
        cardRow.AverageOrder.Should().Be(100m);

        var unspec = result.Methods.First(m => m.Method == "Unspecified");
        unspec.OrderCount.Should().Be(1);
        unspec.Revenue.Should().Be(0m);
        unspec.AverageOrder.Should().Be(0m);
    }

    // ── SS-02 (Wave 2): Walk-up vs preorder ──

    [Fact]
    public async Task GetWalkupVsPreorder_EmptyDatabase_ReturnsZeroEverywhere()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetWalkupVsPreorderAsync(null, null);

        result.WalkUp.OrderCount.Should().Be(0);
        result.WalkUp.Revenue.Should().Be(0m);
        result.Preorder.OrderCount.Should().Be(0);
        result.WalkUpRatio.Should().Be(0d);
    }

    [Fact]
    public async Task GetWalkupVsPreorder_HappyPath_ComputesRatioAndAverages()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("WvP Customer");
        var plant = TestDataBuilder.CreatePlant(sku: "WVP", barcode: "BC-WVP");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        // 3 walk-ups, 1 preorder
        var w1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete, isWalkUp: true);
        w1.AmountTendered = 25m;
        var w2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete, isWalkUp: true);
        w2.AmountTendered = 35m;
        var w3 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: true);
        w3.AmountTendered = 40m;
        var p1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        p1.AmountTendered = 100m;
        var draft = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft, isWalkUp: true);
        draft.AmountTendered = 9999m;

        db.Orders.AddRange(w1, w2, w3, p1, draft);
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(w1.Id, plant.Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(w2.Id, plant.Id, qtyOrdered: 2),
            TestDataBuilder.CreateOrderLine(w3.Id, plant.Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(p1.Id, plant.Id, qtyOrdered: 5),
            TestDataBuilder.CreateOrderLine(draft.Id, plant.Id, qtyOrdered: 99)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetWalkupVsPreorderAsync(null, null);

        result.WalkUp.OrderCount.Should().Be(3);
        result.WalkUp.ItemCount.Should().Be(4);
        result.WalkUp.Revenue.Should().Be(100m);
        result.WalkUp.AverageOrder.Should().BeApproximately(33.33m, 0.01m);

        result.Preorder.OrderCount.Should().Be(1);
        result.Preorder.ItemCount.Should().Be(5);
        result.Preorder.Revenue.Should().Be(100m);
        result.Preorder.AverageOrder.Should().Be(100m);

        result.WalkUpRatio.Should().BeApproximately(0.75d, 0.0001d);
    }

    // ── SS-02 (Wave 2): Status funnel ──

    [Fact]
    public async Task GetOrderStatusFunnel_EmptyDatabase_ReturnsEmptyBucketsAndZeroTotal()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetOrderStatusFunnelAsync();

        result.Total.Should().Be(0);
        result.Buckets.Should().BeEmpty();
    }

    [Fact]
    public async Task GetOrderStatusFunnel_HappyPath_ExcludesDraftAndComputesPercent()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer("SF Customer");
        db.Customers.Add(customer);

        // 2 Open, 1 InProgress, 1 Complete, 1 Cancelled, 5 Draft (excluded)
        db.Orders.AddRange(
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Cancelled),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft),
            TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetOrderStatusFunnelAsync();

        result.Total.Should().Be(5);
        result.Buckets.Should().NotContain(b => b.Status == OrderStatus.Draft);

        var open = result.Buckets.First(b => b.Status == OrderStatus.Open);
        open.Count.Should().Be(2);
        open.Percent.Should().Be(40d);

        var inProgress = result.Buckets.First(b => b.Status == OrderStatus.InProgress);
        inProgress.Count.Should().Be(1);
        inProgress.Percent.Should().Be(20d);
    }

    // ── SS-02 (Wave 2): Top movers ──

    [Fact]
    public async Task GetTopMovers_EmptyDatabase_ReturnsEmptyList()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetTopMoversAsync();

        result.Plants.Should().BeEmpty();
    }

    [Fact]
    public async Task GetTopMovers_HappyPath_SortsByQtyOrderedDesc_RespectsLimit()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("TM Customer");
        var rose = TestDataBuilder.CreatePlant(name: "Rose", sku: "TM-ROSE", barcode: "BC-TM-ROSE");
        var tulip = TestDataBuilder.CreatePlant(name: "Tulip", sku: "TM-TULIP", barcode: "BC-TM-TULIP");
        var daisy = TestDataBuilder.CreatePlant(name: "Daisy", sku: "TM-DAISY", barcode: "BC-TM-DAISY");

        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(rose, tulip, daisy);

        var order1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        var order2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);
        var draft = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft);
        db.Orders.AddRange(order1, order2, draft);

        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(order1.Id, tulip.Id, qtyOrdered: 10, qtyFulfilled: 5),
            TestDataBuilder.CreateOrderLine(order2.Id, tulip.Id, qtyOrdered: 2, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(order1.Id, rose.Id, qtyOrdered: 3, qtyFulfilled: 3),
            TestDataBuilder.CreateOrderLine(order2.Id, daisy.Id, qtyOrdered: 1, qtyFulfilled: 0),
            // Draft lines must be excluded
            TestDataBuilder.CreateOrderLine(draft.Id, rose.Id, qtyOrdered: 999, qtyFulfilled: 999)
        );
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetTopMoversAsync(limit: 25);

        result.Plants.Should().HaveCount(3);
        result.Plants[0].PlantName.Should().Be("Tulip");
        result.Plants[0].QtyOrdered.Should().Be(12);
        result.Plants[0].QtyFulfilled.Should().Be(6);
        result.Plants[0].OrderCount.Should().Be(2);

        result.Plants[1].PlantName.Should().Be("Rose");
        result.Plants[1].QtyOrdered.Should().Be(3);

        // limit honored
        var limited = await service.GetTopMoversAsync(limit: 1);
        limited.Plants.Should().HaveCount(1);
        limited.Plants[0].PlantName.Should().Be("Tulip");
    }

    // ── SS-02 (Wave 2): Outstanding aging ──

    [Fact]
    public async Task GetOutstandingAging_EmptyDatabase_ReturnsAllFourBucketsZero()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ReportService(db);

        var result = await service.GetOutstandingAgingAsync();

        result.Buckets.Should().HaveCount(4);
        result.Buckets.Select(b => b.Bucket).Should().Equal("<24h", "1-3d", "3-7d", ">7d");
        result.Buckets.Should().OnlyContain(b => b.Count == 0 && b.OldestAgeHours == 0d);
    }

    [Fact]
    public async Task GetOutstandingAging_HappyPath_BucketsOpenInProgressByAge()
    {
        using var db = MockDbContextFactory.Create();

        var customer = TestDataBuilder.CreateCustomer("Aging Customer");
        db.Customers.Add(customer);

        var now = DateTimeOffset.UtcNow;

        // < 24h: 2 hours old (Open) + 12 hours (InProgress)
        var fresh1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var fresh2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        // 1-3d: 36h old
        var mid = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        // > 7d: 200h old
        var stale = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
        // Complete should be excluded entirely
        var done = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete);

        db.Orders.AddRange(fresh1, fresh2, mid, stale, done);
        await db.SaveChangesAsync();

        // SaveChangesAsync stamps CreatedAt to UtcNow on insert, so override
        // afterward and re-save as Modified to land the test ages.
        fresh1.CreatedAt = now.AddHours(-2);
        fresh2.CreatedAt = now.AddHours(-12);
        mid.CreatedAt = now.AddHours(-36);
        stale.CreatedAt = now.AddHours(-200);
        done.CreatedAt = now.AddHours(-300);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var result = await service.GetOutstandingAgingAsync();

        var under24 = result.Buckets.First(b => b.Bucket == "<24h");
        under24.Count.Should().Be(2);
        under24.OldestAgeHours.Should().BeGreaterThanOrEqualTo(12d);

        var oneToThree = result.Buckets.First(b => b.Bucket == "1-3d");
        oneToThree.Count.Should().Be(1);

        var threeToSeven = result.Buckets.First(b => b.Bucket == "3-7d");
        threeToSeven.Count.Should().Be(0);

        var overSeven = result.Buckets.First(b => b.Bucket == ">7d");
        overSeven.Count.Should().Be(1);
        overSeven.OldestAgeHours.Should().BeGreaterThanOrEqualTo(200d);
    }
}
