using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Editing or deleting a preorder line while a pickup station scans it. Both
/// used to run without any lock: the edit's "not below fulfilled" check and the
/// delete's "nothing fulfilled yet" check read a value the scan then changed.
/// Each test holds the edit/delete just before it writes the line and runs the
/// scan into it.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class PreorderLineEditRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public PreorderLineEditRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    private static PauseBeforeCommand BeforeLineWrite() =>
        new("before UPDATE \"OrderLines\"", sql => sql.Contains("UPDATE \"OrderLines\"", StringComparison.Ordinal));

    private static Task<(int Ordered, int Fulfilled, bool Deleted)> LineAsync(PgTestDb db, Guid lineId) =>
        db.QueryAsync(async ctx =>
        {
            var l = await ctx.OrderLines.IgnoreQueryFilters().AsNoTracking().SingleAsync(x => x.Id == lineId);
            return (l.QtyOrdered, l.QtyFulfilled, l.DeletedAt != null);
        });

    private static Task<Guid> OnlyLineAsync(PgTestDb db, Guid orderId) =>
        db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking().Where(l => l.OrderId == orderId).Select(l => l.Id).SingleAsync());

    [PostgresFact]
    public async Task Lowering_the_ordered_quantity_while_the_line_is_scanned_does_not_500_or_overfill()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 10, 3);
        var orderId = sale.OrderIds[0];
        var lineId = await OnlyLineAsync(db, orderId);
        await using (var setup = db.NewStation("setup"))
        {
            await setup.Fulfillment.ScanAsync(orderId, sale.Barcode, 2, "pre-1");
        }

        var failures = new FailureLog();
        var gate = BeforeLineWrite();
        await using var desk = db.NewStation("edit", gate, failures);
        await using var pickup = db.NewStation("pickup", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => desk.Orders.UpdateLineAsync(orderId, lineId, new UpdateOrderLineRequest { QtyOrdered = 2 }),
            () => pickup.Fulfillment.ScanAsync(orderId, sale.Barcode, 1, "race-1"));
        _output.WriteLine($"edit: {result.First}\nscan: {result.Second}\nqueued: {result.SecondWaitedOnLock}\nerrors: {failures}");

        result.First.Succeeded.Should().BeTrue($"the edit was valid when made: {result.First}");
        result.Second.Succeeded.Should().BeTrue($"scan: {result.Second}");
        var line = await LineAsync(db, lineId);
        line.Fulfilled.Should().BeLessThanOrEqualTo(line.Ordered);
        (await SaleData.OnHandAsync(db, sale.PlantId) + line.Fulfilled).Should().Be(10, "stock is on the shelf or on the line");
    }

    [PostgresFact]
    public async Task Deleting_a_line_while_it_is_scanned_loses_no_stock()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 10, 1);
        var orderId = sale.OrderIds[0];
        var lineId = await OnlyLineAsync(db, orderId);

        var failures = new FailureLog();
        var gate = BeforeLineWrite();
        await using var desk = db.NewStation("delete", gate, failures);
        await using var pickup = db.NewStation("pickup", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => desk.Orders.DeleteLineAsync(orderId, lineId),
            () => pickup.Fulfillment.ScanAsync(orderId, sale.Barcode, 1, "race-1"));
        _output.WriteLine($"delete: {result.First}\nscan: {result.Second}\nqueued: {result.SecondWaitedOnLock}\nerrors: {failures}");

        var line = await LineAsync(db, lineId);
        var onHand = await SaleData.OnHandAsync(db, sale.PlantId);
        _output.WriteLine($"line: {line}, onHand: {onHand}, scan result: {result.Second.Value?.Result}");
        if (line.Deleted)
            onHand.Should().Be(10, "a deleted line must not hold the stock a scan took");
        else
            (onHand + line.Fulfilled).Should().Be(10);
    }
}
