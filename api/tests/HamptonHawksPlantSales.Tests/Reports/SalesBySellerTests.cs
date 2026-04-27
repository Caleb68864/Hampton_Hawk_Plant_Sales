using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Reports;

public class SalesBySellerTests
{
    [Fact]
    public async Task GetSalesBySeller_ReturnsAggregatedRows()
    {
        using var db = MockDbContextFactory.Create();

        var sellerA = new Seller { DisplayName = "Alice" };
        var sellerB = new Seller { DisplayName = "Bob" };
        var sellerC = new Seller { DisplayName = "Carol" };

        var customer = TestDataBuilder.CreateCustomer("Walk-in");

        var plant1 = TestDataBuilder.CreatePlant(name: "Rose", sku: "ROSE", barcode: "BC-ROSE");
        plant1.Price = 5m;
        var plant2 = TestDataBuilder.CreatePlant(name: "Tulip", sku: "TULIP", barcode: "BC-TULIP");
        plant2.Price = 10m;

        db.Sellers.AddRange(sellerA, sellerB, sellerC);
        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(plant1, plant2);

        // Each seller has 2 orders, mixed plant lines, mixed fulfillment.
        Order MakeOrder(Guid sellerId, string num)
        {
            var o = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);
            o.OrderNumber = num;
            o.SellerId = sellerId;
            return o;
        }

        var aOrder1 = MakeOrder(sellerA.Id, "A-1");
        var aOrder2 = MakeOrder(sellerA.Id, "A-2");
        var bOrder1 = MakeOrder(sellerB.Id, "B-1");
        var bOrder2 = MakeOrder(sellerB.Id, "B-2");
        var cOrder1 = MakeOrder(sellerC.Id, "C-1");
        var cOrder2 = MakeOrder(sellerC.Id, "C-2");

        db.Orders.AddRange(aOrder1, aOrder2, bOrder1, bOrder2, cOrder1, cOrder2);

        // Seller A: 5 lines across 2 orders -> 20 ordered, 10 fulfilled
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(aOrder1.Id, plant1.Id, qtyOrdered: 5, qtyFulfilled: 5),  // 25 / 25
            TestDataBuilder.CreateOrderLine(aOrder1.Id, plant2.Id, qtyOrdered: 3, qtyFulfilled: 1),  // 30 / 10
            TestDataBuilder.CreateOrderLine(aOrder1.Id, plant1.Id, qtyOrdered: 2, qtyFulfilled: 0),  // 10 /  0
            TestDataBuilder.CreateOrderLine(aOrder2.Id, plant2.Id, qtyOrdered: 4, qtyFulfilled: 2),  // 40 / 20
            TestDataBuilder.CreateOrderLine(aOrder2.Id, plant1.Id, qtyOrdered: 6, qtyFulfilled: 2)   // 30 / 10
        );
        // Seller A totals: itemsOrdered=20, itemsFulfilled=10
        // revenueOrdered = 25+30+10+40+30 = 135; revenueFulfilled = 25+10+0+20+10 = 65

        // Seller B: 5 lines, fully fulfilled
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(bOrder1.Id, plant1.Id, qtyOrdered: 1, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(bOrder1.Id, plant2.Id, qtyOrdered: 1, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(bOrder1.Id, plant2.Id, qtyOrdered: 1, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(bOrder2.Id, plant1.Id, qtyOrdered: 1, qtyFulfilled: 1),
            TestDataBuilder.CreateOrderLine(bOrder2.Id, plant1.Id, qtyOrdered: 1, qtyFulfilled: 1)
        );
        // Seller B totals: itemsOrdered=5, itemsFulfilled=5
        // revenueOrdered = 5+10+10+5+5 = 35; revenueFulfilled = same = 35

        // Seller C: 5 lines, none fulfilled
        db.OrderLines.AddRange(
            TestDataBuilder.CreateOrderLine(cOrder1.Id, plant1.Id, qtyOrdered: 2, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(cOrder1.Id, plant1.Id, qtyOrdered: 2, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(cOrder1.Id, plant2.Id, qtyOrdered: 1, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(cOrder2.Id, plant2.Id, qtyOrdered: 1, qtyFulfilled: 0),
            TestDataBuilder.CreateOrderLine(cOrder2.Id, plant1.Id, qtyOrdered: 4, qtyFulfilled: 0)
        );
        // Seller C totals: itemsOrdered=10, itemsFulfilled=0
        // revenueOrdered = 10+10+10+10+20 = 60; revenueFulfilled = 0

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesBySellerAsync();

        rows.Should().HaveCount(3);

        var rowA = rows.First(r => r.SellerId == sellerA.Id);
        rowA.SellerDisplayName.Should().Be("Alice");
        rowA.OrderCount.Should().Be(2);
        rowA.ItemsOrdered.Should().Be(20);
        rowA.ItemsFulfilled.Should().Be(10);
        rowA.RevenueOrdered.Should().Be(135m);
        rowA.RevenueFulfilled.Should().Be(65m);

        var rowB = rows.First(r => r.SellerId == sellerB.Id);
        rowB.OrderCount.Should().Be(2);
        rowB.ItemsOrdered.Should().Be(5);
        rowB.ItemsFulfilled.Should().Be(5);
        rowB.RevenueOrdered.Should().Be(35m);
        rowB.RevenueFulfilled.Should().Be(35m);

        var rowC = rows.First(r => r.SellerId == sellerC.Id);
        rowC.OrderCount.Should().Be(2);
        rowC.ItemsOrdered.Should().Be(10);
        rowC.ItemsFulfilled.Should().Be(0);
        rowC.RevenueOrdered.Should().Be(60m);
        rowC.RevenueFulfilled.Should().Be(0m);
    }

    [Fact]
    public async Task GetSalesBySeller_SellerWithNoOrders_ReturnsZeroRow()
    {
        using var db = MockDbContextFactory.Create();

        var sellerEmpty = new Seller { DisplayName = "Empty Seller" };
        db.Sellers.Add(sellerEmpty);
        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesBySellerAsync();

        rows.Should().HaveCount(1);
        var row = rows[0];
        row.SellerId.Should().Be(sellerEmpty.Id);
        row.SellerDisplayName.Should().Be("Empty Seller");
        row.OrderCount.Should().Be(0);
        row.ItemsOrdered.Should().Be(0);
        row.ItemsFulfilled.Should().Be(0);
        row.RevenueOrdered.Should().Be(0m);
        row.RevenueFulfilled.Should().Be(0m);
    }

    [Fact]
    public async Task GetSalesBySeller_ExcludesSoftDeletedOrders()
    {
        using var db = MockDbContextFactory.Create();

        var seller = new Seller { DisplayName = "Solo" };
        var customer = TestDataBuilder.CreateCustomer("Buyer");
        var plant = TestDataBuilder.CreatePlant(name: "Cactus", sku: "CACT", barcode: "BC-CACT");
        plant.Price = 7m;

        db.Sellers.Add(seller);
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var liveOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        liveOrder.SellerId = seller.Id;
        liveOrder.OrderNumber = "LIVE";

        var deletedOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        deletedOrder.SellerId = seller.Id;
        deletedOrder.OrderNumber = "DEL";
        deletedOrder.DeletedAt = DateTimeOffset.UtcNow;

        db.Orders.AddRange(liveOrder, deletedOrder);

        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(liveOrder.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 1));
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(deletedOrder.Id, plant.Id, qtyOrdered: 100, qtyFulfilled: 100));

        await db.SaveChangesAsync();

        var service = new ReportService(db);
        var rows = await service.GetSalesBySellerAsync();

        rows.Should().HaveCount(1);
        var row = rows[0];
        row.OrderCount.Should().Be(1);          // deleted order excluded
        row.ItemsOrdered.Should().Be(2);        // only live line
        row.ItemsFulfilled.Should().Be(1);
        row.RevenueOrdered.Should().Be(14m);    // 2 * 7
        row.RevenueFulfilled.Should().Be(7m);   // 1 * 7
    }
}
