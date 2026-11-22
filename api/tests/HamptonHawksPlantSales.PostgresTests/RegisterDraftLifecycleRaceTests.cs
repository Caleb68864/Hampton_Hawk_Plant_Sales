using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// A register scan still in flight while the same draft is cancelled or closed
/// (two tabs, a retry, a second volunteer at the same register). The scan used to
/// check the draft's status before its transaction and never again, and cancel /
/// close read the draft's lines without any lock the scan takes, so:
///   - cancel restored only the lines it had loaded, and the in-flight scan then
///     committed its line and took its stock on the deleted draft (units lost);
///   - close took payment for the lines it saw, and the scan then added units to
///     the Complete order.
/// Each test holds the scan just before its stock write (all its locks taken) and
/// runs the cancel / close into it.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class RegisterDraftLifecycleRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public RegisterDraftLifecycleRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    private async Task<(PgTestDb Db, SaleSetup A, SaleSetup B, Guid Draft)> DraftWithPlantAAsync()
    {
        var db = await _pg.CreateDatabaseAsync();
        var a = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        var b = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        Guid draft;
        await using (var setup = db.NewStation("setup"))
        {
            draft = (await setup.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" })).Id;
            await setup.Register.ScanIntoDraftAsync(draft, new ScanIntoDraftRequest { PlantBarcode = a.Barcode, ScanId = "a-1" });
        }
        return (db, a, b, draft);
    }

    [PostgresFact]
    public async Task Cancelling_a_draft_while_a_scan_of_a_new_plant_is_in_flight_loses_no_stock()
    {
        var (db, a, b, draft) = await DraftWithPlantAAsync();

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var scanner = db.NewStation("scan", gate, failures);
        await using var manager = db.NewStation("cancel", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => scanner.Register.ScanIntoDraftAsync(draft, new ScanIntoDraftRequest { PlantBarcode = b.Barcode, ScanId = "b-1" }),
            () => manager.Register.CancelDraftAsync(draft, "customer left"));
        Report(result, failures);

        result.Second.Succeeded.Should().BeTrue($"the cancel must go through: {result.Second}");
        (await SaleData.OnHandAsync(db, a.PlantId)).Should().Be(5, "the cancel put plant A back");
        (await SaleData.OnHandAsync(db, b.PlantId)).Should().Be(5,
            "either the scan was refused, or it committed first and the cancel put it back too");
        (await LiveLinesAsync(db, draft)).Should().Be(0, "a cancelled draft keeps no live lines");
    }

    [PostgresFact]
    public async Task Closing_a_draft_while_a_scan_is_in_flight_does_not_add_units_after_payment()
    {
        var (db, _, b, draft) = await DraftWithPlantAAsync();

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var scanner = db.NewStation("scan", gate, failures);
        await using var cashier = db.NewStation("close", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => scanner.Register.ScanIntoDraftAsync(draft, new ScanIntoDraftRequest { PlantBarcode = b.Barcode, ScanId = "b-1" }),
            () => cashier.Register.CloseDraftAsync(draft, new CloseDraftRequest { PaymentMethod = "Cash", AmountTendered = 100m }));
        Report(result, failures);

        result.Second.Succeeded.Should().BeTrue($"the close must go through: {result.Second}");
        var closedLines = result.Second.Value!.Lines.Sum(l => l.QtyOrdered);
        var finalLines = await db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.OrderId == draft && l.DeletedAt == null).SumAsync(l => l.QtyOrdered));
        finalLines.Should().Be(closedLines, "nothing may be added to the sale after it was closed and paid");
        var onHandB = await SaleData.OnHandAsync(db, b.PlantId);
        var soldB = await db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.OrderId == draft && l.PlantCatalogId == b.PlantId && l.DeletedAt == null).SumAsync(l => l.QtyFulfilled));
        (onHandB + soldB).Should().Be(5, "plant B's stock is either on the shelf or on the sale");
    }

    [PostgresFact]
    public async Task A_scan_that_queues_behind_a_cancel_is_refused_and_takes_no_stock()
    {
        var (db, a, b, draft) = await DraftWithPlantAAsync();

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var manager = db.NewStation("cancel", gate, failures);
        await using var scanner = db.NewStation("scan", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => manager.Register.CancelDraftAsync(draft, "customer left"),
            () => scanner.Register.ScanIntoDraftAsync(draft, new ScanIntoDraftRequest { PlantBarcode = b.Barcode, ScanId = "b-1" }));
        Report(result, failures);

        result.First.Succeeded.Should().BeTrue($"cancel: {result.First}");
        result.Second.Error.Should().BeOfType<KeyNotFoundException>("the draft is gone once the cancel commits");
        (await SaleData.OnHandAsync(db, a.PlantId)).Should().Be(5);
        (await SaleData.OnHandAsync(db, b.PlantId)).Should().Be(5);
        (await LiveLinesAsync(db, draft)).Should().Be(0);
    }

    private static Task<int> LiveLinesAsync(PgTestDb db, Guid orderId) =>
        db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking().CountAsync(l => l.OrderId == orderId && l.DeletedAt == null));

    private void Report<TA, TB>(InterleaveResult<TA, TB> result, FailureLog failures)
    {
        _output.WriteLine($"scan: {result.First}");
        _output.WriteLine($"other: {result.Second}");
        _output.WriteLine($"other queued on a lock: {result.SecondWaitedOnLock}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");
    }
}
