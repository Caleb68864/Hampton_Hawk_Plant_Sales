using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Two pickup stations scanning at the same moment, through the real
/// <c>FulfillmentService.ScanAsync</c> on a real Postgres server.
///
/// The scan path's protection is a SERIALIZABLE transaction plus <c>SELECT ... FOR UPDATE</c>
/// on the inventory and order-line rows, with serialization failures retried. None of that
/// exists on the EF InMemory provider the unit tests use, so this is the only place an
/// oversell or a double pick between stations can be seen at all.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class PickupScanRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public PickupScanRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [PostgresFact]
    public async Task Two_stations_scanning_the_last_unit_for_different_orders_hand_over_exactly_one()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 1, 1, 1);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var a = db.NewStation("A", gate, failures);
        await using var b = db.NewStation("B", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => a.Fulfillment.ScanAsync(sale.OrderIds[0], sale.Barcode),
            () => b.Fulfillment.ScanAsync(sale.OrderIds[1], sale.Barcode));

        Report(result, failures);

        result.First.Succeeded.Should().BeTrue();
        result.Second.Succeeded.Should().BeTrue();
        var outcomes = new[] { result.First.Value!.Result, result.Second.Value!.Result };

        outcomes.Should().ContainSingle(r => r == FulfillmentResult.Accepted, "there was one plant on the table");
        outcomes.Should().ContainSingle(r => r == FulfillmentResult.OutOfStock,
            "the other station must be told the truth -- out of stock -- not a conflict to rescan");

        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(0);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(1, "one plant handed over, one line fulfilled");
        (await SaleData.EventsAsync(db, sale.PlantId))
            .Count(e => e.Result == FulfillmentResult.Accepted).Should().Be(1);
    }

    [PostgresFact]
    public async Task Two_stations_scanning_the_same_order_line_pick_it_only_once()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 1);
        var order = sale.OrderIds[0];

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var a = db.NewStation("A", gate, failures);
        await using var b = db.NewStation("B", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => a.Fulfillment.ScanAsync(order, sale.Barcode),
            () => b.Fulfillment.ScanAsync(order, sale.Barcode));

        Report(result, failures);

        result.First.Succeeded.Should().BeTrue();
        result.Second.Succeeded.Should().BeTrue();
        var outcomes = new[] { result.First.Value!.Result, result.Second.Value!.Result };

        outcomes.Should().ContainSingle(r => r == FulfillmentResult.Accepted, "the customer ordered one");
        outcomes.Should().ContainSingle(r => r == FulfillmentResult.AlreadyFulfilled);

        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(1);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(4, "exactly one plant left the table");

        var events = await SaleData.EventsAsync(db, sale.PlantId);
        events.Count(e => e.Result == FulfillmentResult.Accepted).Should().Be(1);

        // The losing station must see "already fulfilled" because the line really is, not the
        // "another station updated this order, scan again" fallback used when retries run out.
        // Ask a volunteer to rescan a line that is done and they will try to hand over a second plant.
        events.Where(e => e.Result == FulfillmentResult.AlreadyFulfilled)
            .Should().ContainSingle()
            .Which.Message.Should().Contain("already fully fulfilled")
            .And.NotContain("Concurrent scan conflict");
    }

    [PostgresFact]
    public async Task A_station_that_loses_a_serialization_conflict_retries_and_its_scan_still_lands()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 2, 1, 1);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var a = db.NewStation("A", gate, failures);
        await using var b = db.NewStation("B", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => a.Fulfillment.ScanAsync(sale.OrderIds[0], sale.Barcode),
            () => b.Fulfillment.ScanAsync(sale.OrderIds[1], sale.Barcode));

        Report(result, failures);

        // The conflict has to have happened, or this test is not exercising the retry at all.
        failures.SqlStates.Should().Contain(s => s == "40001" || s == "40P01",
            "the staged overlap must make Postgres abort one station's transaction; " +
            $"errors seen: {failures}");

        // Two plants, two orders: both volunteers must see their scan accepted. Without the
        // retry the loser is told to rescan a plant that was in stock the whole time.
        result.First.Value!.Result.Should().Be(FulfillmentResult.Accepted);
        result.Second.Value!.Result.Should().Be(FulfillmentResult.Accepted);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(0);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(2);
    }

    /// <summary>
    /// No staging: four stations released at once against two plants, repeated over several
    /// rounds, the way the stations would actually hit the server. The interleaving is up to
    /// the scheduler, so this complements the staged tests rather than replacing them.
    /// </summary>
    [PostgresFact]
    public async Task Four_stations_released_at_once_on_two_plants_sell_exactly_two_every_round()
    {
        const int rounds = 5;
        const int stations = 4;
        const int stock = 2;

        var db = await _pg.CreateDatabaseAsync();

        for (var round = 1; round <= rounds; round++)
        {
            var sale = await SaleData.PlantWithOrdersAsync(db, stock, Enumerable.Repeat(1, stations).ToArray());
            var failures = new FailureLog();
            var go = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

            var scans = Enumerable.Range(0, stations).Select(i => Task.Run(async () =>
            {
                await using var station = db.NewStation($"S{i + 1}", failures: failures);
                await go.Task;
                return await station.Fulfillment.ScanAsync(sale.OrderIds[i], sale.Barcode);
            })).ToArray();

            go.SetResult();
            var responses = await Task.WhenAll(scans).WaitAsync(TimeSpan.FromSeconds(60));
            var results = responses.Select(r => r.Result).ToList();

            _output.WriteLine($"round {round}: {string.Join(", ", results)}; postgres errors: {failures}");

            results.Count(r => r == FulfillmentResult.Accepted).Should().Be(stock, $"round {round}: two plants, two sales");
            results.Count(r => r == FulfillmentResult.OutOfStock).Should().Be(stations - stock,
                $"round {round}: every other station is told out of stock, not asked to rescan");
            (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(0, $"round {round}");
            (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(stock, $"round {round}");
        }
    }

    private void Report<TA, TB>(InterleaveResult<TA, TB> result, FailureLog failures)
    {
        _output.WriteLine($"A: {Describe(result.First)}");
        _output.WriteLine($"B: {Describe(result.Second)}");
        _output.WriteLine($"B queued on a row lock while A held the stock: {result.SecondWaitedOnLock}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");
    }

    private static string Describe<T>(Outcome<T> outcome) =>
        outcome is { Succeeded: true, Value: ScanResponse scan }
            ? $"{scan.Result} (line {scan.Line?.QtyFulfilled}/{scan.Line?.QtyOrdered})"
            : outcome.ToString();
}
