using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// A pickup scan or manual fulfil checked the order's status before its
/// transaction and never again. A bulk status change to Cancelled that committed
/// between that check and the scan's locks still let the scan take stock on the
/// cancelled order. Each test holds the scan after its status check, before its
/// first lock, and runs the cancel to completion in between.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class ScanStatusRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public ScanStatusRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    private static async Task<SaleSetup> InProgressOrderAsync(PgTestDb db)
    {
        var sale = await SaleData.PlantWithOrdersAsync(db, 5, 3);
        await db.ExecuteAsync(async ctx =>
        {
            var order = await ctx.Orders.SingleAsync(o => o.Id == sale.OrderIds[0]);
            order.Status = OrderStatus.InProgress; // no Open->InProgress write to collide on
            await ctx.SaveChangesAsync();
        });
        return sale;
    }

    private static Task<BulkOperationResult> CancelAsync(Station station, Guid orderId) =>
        station.Orders.BulkSetStatusAsync(
            new BulkSetOrderStatusRequest { OrderIds = new() { orderId }, TargetStatus = OrderStatus.Cancelled }, "customer cancelled");

    [PostgresFact]
    public async Task A_pickup_scan_that_loses_a_race_with_a_cancel_takes_no_stock()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await InProgressOrderAsync(db);
        var orderId = sale.OrderIds[0];

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforePlantLock(occurrence: 1);
        await using var pickup = db.NewStation("pickup", gate, failures);
        await using var desk = db.NewStation("desk", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => pickup.Fulfillment.ScanAsync(orderId, sale.Barcode, 1, "late-scan"),
            () => CancelAsync(desk, orderId));
        _output.WriteLine($"scan: {result.First}\ncancel: {result.Second}\nerrors: {failures}");

        result.Second.Succeeded.Should().BeTrue($"cancel: {result.Second}");
        result.First.Error.Should().BeOfType<ValidationException>("the order was cancelled before the scan took its locks");
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(5);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(0);
    }

    [PostgresFact]
    public async Task A_manual_fulfil_that_loses_a_race_with_a_cancel_takes_no_stock()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await InProgressOrderAsync(db);
        var orderId = sale.OrderIds[0];
        var lineId = await db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking().Where(l => l.OrderId == orderId).Select(l => l.Id).SingleAsync());

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforePlantLock(occurrence: 1);
        await using var desk = db.NewStation("manual", gate, failures);
        await using var other = db.NewStation("desk", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => desk.Fulfillment.ManualFulfillAsync(orderId, new ManualFulfillRequest { OrderLineId = lineId, Reason = "tag", OperatorName = "Desk" }),
            () => CancelAsync(other, orderId));
        _output.WriteLine($"manual: {result.First}\ncancel: {result.Second}\nerrors: {failures}");

        result.Second.Succeeded.Should().BeTrue($"cancel: {result.Second}");
        result.First.Error.Should().BeOfType<ValidationException>();
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(5);
    }
}
