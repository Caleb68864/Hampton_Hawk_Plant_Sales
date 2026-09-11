using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Two walk-up checkout registers, through the real <c>WalkUpRegisterService</c>.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class WalkUpRegisterRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public WalkUpRegisterRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [PostgresFact]
    public async Task Two_registers_ringing_up_the_last_unit_sell_it_once_and_the_other_is_refused_cleanly()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 1);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var a = db.NewStation("A", gate, failures);
        await using var b = db.NewStation("B", failures: failures);

        // Each register opens its own draft first, the way the POS screen does.
        var draftA = await a.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });
        var draftB = await b.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS2" });

        var result = await Interleave.RunAsync(db, gate,
            () => a.Register.ScanIntoDraftAsync(draftA.Id, new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "scan-a" }),
            () => b.Register.ScanIntoDraftAsync(draftB.Id, new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "scan-b" }));

        _output.WriteLine($"A: {result.First}");
        _output.WriteLine($"B: {result.Second}");
        _output.WriteLine($"B queued on a row lock while A held the stock: {result.SecondWaitedOnLock}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");

        var outcomes = new[] { result.First, result.Second };
        outcomes.Count(o => o.Succeeded).Should().Be(1, "there was one plant to sell");

        // The refusal must be the volunteer-facing validation message, not a database error
        // leaking out of the register as a 500.
        outcomes.Single(o => !o.Succeeded).Error.Should().BeOfType<ValidationException>()
            .Which.Message.Should().MatchRegex("out of stock|available");

        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(0);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(1, "one unit rung up across both registers");
    }

    /// <summary>
    /// <c>WalkUpOrderNumbers.NextAsync</c> probes for the lowest free WLK number, so two
    /// registers opening a draft together compute the same one. The unique index on
    /// <c>Orders.OrderNumber</c> rejects the loser with 23505, and the service must
    /// recognise that code and try the next number instead of failing the register.
    /// </summary>
    [PostgresFact]
    public async Task Two_registers_opening_a_draft_at_the_same_instant_get_different_order_numbers()
    {
        var db = await _pg.CreateDatabaseAsync();

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeOrderInsert();
        await using var a = db.NewStation("A", gate, failures);
        await using var b = db.NewStation("B", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => a.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" }),
            () => b.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS2" }));

        _output.WriteLine($"A: {result.First.Value?.OrderNumber ?? result.First.ToString()}");
        _output.WriteLine($"B: {result.Second.Value?.OrderNumber ?? result.Second.ToString()}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");

        failures.Entries.Should().Contain(("A", "23505"),
            "A computed the number B had just taken, so its insert must have hit the unique index");

        result.First.Succeeded.Should().BeTrue("a number collision must be retried, not shown to the volunteer");
        result.Second.Succeeded.Should().BeTrue();
        result.First.Value!.OrderNumber.Should().NotBe(result.Second.Value!.OrderNumber);

        var numbers = await db.QueryAsync(ctx => ctx.Orders.AsNoTracking().Select(o => o.OrderNumber).ToListAsync());
        numbers.Should().BeEquivalentTo(new[] { "WLK-00001", "WLK-00002" });
    }
}

/// <summary>
/// An admin correcting stock while a pickup station scans the same plant.
///
/// <c>InventoryService</c> runs at READ COMMITTED, so its <c>SELECT ... FOR UPDATE</c> is the
/// only thing stopping the two writes from overwriting each other -- there is no
/// serializable safety net behind it, unlike the scan path.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class InventoryAdjustmentRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public InventoryAdjustmentRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [PostgresFact]
    public async Task A_stock_correction_racing_a_pickup_scan_keeps_both_changes()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 3, 1);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var admin = db.NewStation("admin", gate, failures);
        await using var pickup = db.NewStation("pickup", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => admin.Inventory.AdjustInventoryAsync(new AdjustInventoryRequest
            {
                PlantId = sale.PlantId,
                DeltaQty = 5,
                Reason = "Restock from greenhouse"
            }),
            () => pickup.Fulfillment.ScanAsync(sale.OrderIds[0], sale.Barcode));

        _output.WriteLine($"admin adjust: {result.First}");
        _output.WriteLine($"pickup scan: {(result.Second.Succeeded ? result.Second.Value!.Result.ToString() : result.Second.ToString())}");
        _output.WriteLine($"scan queued on a row lock while the adjustment held the stock: {result.SecondWaitedOnLock}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");

        result.First.Succeeded.Should().BeTrue();
        result.Second.Succeeded.Should().BeTrue();
        result.Second.Value!.Result.Should().Be(FulfillmentResult.Accepted);

        // 3 on hand, +5 restocked, 1 handed over. Anything else is a lost write: 8 means the
        // scan's decrement vanished (the plant left but the count never dropped, so it will be
        // sold again); 2 means the restock vanished.
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(7);

        var adjustments = await db.QueryAsync(ctx => ctx.InventoryAdjustments.AsNoTracking()
            .Where(x => x.PlantCatalogId == sale.PlantId).ToListAsync());
        adjustments.Should().ContainSingle().Which.DeltaQty.Should().Be(5);
    }
}
