using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Revenue follows the price a line was sold at (OrderLines.UnitPrice, migration
/// AddOrderLineUnitPrice), so raising a price after the sale does not change what
/// the reports say was taken.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class SalePriceTests
{
    private readonly PostgresFixture _pg;

    public SalePriceTests(PostgresFixture pg) => _pg = pg;

    [PostgresFact]
    public async Task A_register_sale_keeps_its_revenue_after_the_price_changes()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 20);
        await db.ExecuteAsync(async ctx =>
        {
            var plant = await ctx.PlantCatalogs.SingleAsync(p => p.Id == sale.PlantId);
            plant.Price = 5m;
            await ctx.SaveChangesAsync();
        });

        await using (var register = db.NewStation("register"))
        {
            var draft = await register.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });
            await register.Register.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "s1", Quantity = 10 });
            await register.Register.CloseDraftAsync(draft.Id, new CloseDraftRequest { PaymentMethod = "Cash", AmountTendered = 50m });
        }

        await db.ExecuteAsync(async ctx =>
        {
            var plant = await ctx.PlantCatalogs.SingleAsync(p => p.Id == sale.PlantId);
            plant.Price = 6m;
            await ctx.SaveChangesAsync();
        });

        var revenue = await db.QueryAsync(ctx => new ReportService(ctx).GetSalesByPlantAsync());
        revenue.Single(r => r.PlantCatalogId == sale.PlantId).RevenueFulfilled.Should().Be(50m);
        var cash = await db.QueryAsync(ctx => new ReportService(ctx).GetPaymentBreakdownAsync(null, null));
        cash.Methods.Single(m => m.Method == "Cash").Revenue.Should().Be(50m);
    }

    [PostgresFact]
    public async Task A_soft_deleted_customers_sales_stay_in_the_per_customer_report()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 10, 2);
        Guid customerId = Guid.Empty;
        await db.ExecuteAsync(async ctx =>
        {
            var plant = await ctx.PlantCatalogs.SingleAsync(p => p.Id == sale.PlantId);
            plant.Price = 3m;
            var customer = new HamptonHawksPlantSales.Core.Models.Customer { DisplayName = "Left Town", PickupCode = "LT2345" };
            ctx.Customers.Add(customer);
            await ctx.SaveChangesAsync();
            var order = await ctx.Orders.SingleAsync(o => o.Id == sale.OrderIds[0]);
            order.CustomerId = customer.Id;
            await ctx.SaveChangesAsync();
            customer.DeletedAt = DateTimeOffset.UtcNow;
            await ctx.SaveChangesAsync();
            customerId = customer.Id;
        });

        var rows = await db.QueryAsync(ctx => new ReportService(ctx).GetSalesByCustomerAsync());

        var row = rows.Single(r => r.CustomerId == customerId);
        row.CustomerDisplayName.Should().Be("Left Town (deleted)");
        row.ItemsOrdered.Should().Be(2);
    }
}
