using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Tests.Helpers;
using HamptonHawksPlantSales.Infrastructure.Services;

namespace HamptonHawksPlantSales.Tests.Services;

public class ReportServiceTests
{
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
}
