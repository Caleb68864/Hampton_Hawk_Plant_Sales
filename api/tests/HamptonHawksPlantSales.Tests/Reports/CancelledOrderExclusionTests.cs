using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Reports;

/// <summary>
/// A cancelled order produced no sale. Every count and revenue aggregate must
/// leave it out; only the status enumerations (funnel, dashboard OrdersByStatus)
/// keep it visible.
/// </summary>
public class CancelledOrderExclusionTests
{
    private static async Task<(Guid PlantId, Guid CustomerId)> Seed(AppDbContext db)
    {
        var plant = TestDataBuilder.CreatePlant(sku: "P-1", barcode: "BC-P1");
        plant.Price = 10m;
        var customer = TestDataBuilder.CreateCustomer();

        var open = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var cancelled = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Cancelled);

        db.PlantCatalogs.Add(plant);
        db.Customers.Add(customer);
        db.Orders.AddRange(open, cancelled);
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(open.Id, plant.Id, qtyOrdered: 2));
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(cancelled.Id, plant.Id, qtyOrdered: 3));
        await db.SaveChangesAsync();
        return (plant.Id, customer.Id);
    }

    [Fact]
    public async Task Dashboard_ExcludesCancelledFromCountsButListsItInOrdersByStatus()
    {
        using var db = MockDbContextFactory.Create();
        await Seed(db);

        var metrics = await new ReportService(db).GetDashboardMetricsAsync();

        metrics.TotalOrders.Should().Be(1);
        metrics.TotalItemsOrdered.Should().Be(2);
        metrics.OrdersByStatus.Should().ContainKey("Cancelled").WhoseValue.Should().Be(1);
    }

    [Fact]
    public async Task DailySales_ExcludesCancelledOrders()
    {
        using var db = MockDbContextFactory.Create();
        await Seed(db);

        var daily = await new ReportService(db).GetDailySalesAsync(null, null);

        daily.Days.Should().ContainSingle();
        daily.Days[0].OrderCount.Should().Be(1);
        daily.Days[0].ItemCount.Should().Be(2);
        daily.Days[0].Revenue.Should().Be(20m);
    }

    [Fact]
    public async Task SalesByPlant_ExcludesCancelledOrders()
    {
        using var db = MockDbContextFactory.Create();
        var (plantId, _) = await Seed(db);

        var rows = await new ReportService(db).GetSalesByPlantAsync();

        var row = rows.Single(r => r.PlantCatalogId == plantId);
        row.OrderCount.Should().Be(1);
        row.ItemsOrdered.Should().Be(2);
        row.RevenueOrdered.Should().Be(20m);
    }

    [Fact]
    public async Task SalesByCustomer_ExcludesCancelledOrders()
    {
        using var db = MockDbContextFactory.Create();
        var (_, customerId) = await Seed(db);

        var rows = await new ReportService(db).GetSalesByCustomerAsync();

        rows.Single(r => r.CustomerId == customerId).OrderCount.Should().Be(1);
    }

    [Fact]
    public async Task StatusFunnel_StillShowsCancelledBucket()
    {
        using var db = MockDbContextFactory.Create();
        await Seed(db);

        var funnel = await new ReportService(db).GetOrderStatusFunnelAsync();

        funnel.Buckets.Should().Contain(b => b.Status == OrderStatus.Cancelled && b.Count == 1);
        funnel.Total.Should().Be(2);
    }
}
