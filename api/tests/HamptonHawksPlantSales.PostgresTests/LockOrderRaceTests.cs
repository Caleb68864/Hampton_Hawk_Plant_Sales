using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Pairs of write paths that, before the canonical lock order (see <c>WalkUpRowLocks</c>),
/// took their row locks in opposite orders. Each test holds the first path with some of
/// its locks taken, runs the second into it, and then lets both finish. With one order
/// everywhere the second path simply queues; with two orders Postgres has to break a
/// deadlock and one side sees 40P01 (retried on some paths, surfaced on others).
///
/// Some inversions are implicit: inserting a <c>FulfillmentEvent</c>, an
/// <c>InventoryAdjustment</c> or an <c>OrderLine</c> takes <c>FOR KEY SHARE</c> on the
/// referenced plant row for the foreign key check, and that conflicts with the register's
/// <c>FOR UPDATE</c> on the plant. A path that locked only the inventory row and then
/// inserted one of those was really taking Inventories -> PlantCatalogs.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class LockOrderRaceTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public LockOrderRaceTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    /// <summary>Was OrderLines -> Inventories (manual) against Inventories -> OrderLines (scan).</summary>
    [PostgresFact]
    public async Task Manual_fulfil_and_a_pickup_scan_on_the_same_line_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 2);
        var order = sale.OrderIds[0];
        var lineId = await LineIdAsync(db, order, sale.PlantId);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryLock();
        await using var desk = db.NewStation("manual", gate, failures);
        await using var pickup = db.NewStation("pickup", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => desk.Fulfillment.ManualFulfillAsync(order, new ManualFulfillRequest
            {
                OrderLineId = lineId,
                Reason = "label torn",
                OperatorName = "desk"
            }),
            () => pickup.Fulfillment.ScanAsync(order, sale.Barcode));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);
        result.First.Value!.Result.Should().Be(FulfillmentResult.Accepted);
        result.Second.Value!.Result.Should().Be(FulfillmentResult.Accepted);

        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(2);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(3);

        // Attribution columns round-trip through the real migration.
        (await SaleData.EventsAsync(db, sale.PlantId)).Select(e => e.Source).Should()
            .BeEquivalentTo(new FulfillmentEventSource?[] { FulfillmentEventSource.ManualFulfill, FulfillmentEventSource.PickupScan });
    }

    /// <summary>
    /// Was Inventories -> OrderLines -> PlantCatalogs (scan; the plant via its
    /// <c>BarcodeLockedAt</c> update and the event's FK check) against
    /// PlantCatalogs -> Inventories -> OrderLines (register).
    /// </summary>
    [PostgresFact]
    public async Task A_pickup_scan_and_a_register_scan_of_the_same_plant_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 1);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var pickup = db.NewStation("pickup", gate, failures);
        await using var register = db.NewStation("register", failures: failures);
        var draft = await register.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });

        var result = await Interleave.RunAsync(db, gate,
            () => pickup.Fulfillment.ScanAsync(sale.OrderIds[0], sale.Barcode),
            () => register.Register.ScanIntoDraftAsync(draft.Id,
                new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "pos-1" }));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);
        result.First.Value!.Result.Should().Be(FulfillmentResult.Accepted);
        result.Second.Value!.Lines.Should().ContainSingle().Which.QtyFulfilled.Should().Be(1);

        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(3);
    }

    /// <summary>Was ScanSessions -> OrderLines -> Inventories (session) against Inventories -> OrderLines (scan).</summary>
    [PostgresFact]
    public async Task A_session_scan_and_a_pickup_scan_on_the_same_line_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 2);
        var order = sale.OrderIds[0];
        var sessionId = await SessionForAsync(db, order);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryLock();
        await using var session = db.NewStation("session", gate, failures);
        await using var pickup = db.NewStation("pickup", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => session.Sessions.ScanInSessionAsync(sessionId, sale.Barcode),
            () => pickup.Fulfillment.ScanAsync(order, sale.Barcode));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);
        result.First.Value!.Result.Should().Be(ScanSessionResult.Accepted);
        result.Second.Value!.Result.Should().Be(FulfillmentResult.Accepted);

        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(2);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(3);
    }

    /// <summary>Was OrderLines -> Inventories (adjust) against PlantCatalogs -> Inventories -> OrderLines (scan).</summary>
    [PostgresFact]
    public async Task A_register_quantity_adjust_and_a_scan_into_the_same_draft_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryLock();
        await using var keypad = db.NewStation("adjust", gate, failures);
        await using var scanner = db.NewStation("scan", failures: failures);

        var draft = await scanner.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });
        var first = await scanner.Register.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "scan-1" });
        var lineId = first.Lines.Single().Id;

        var result = await Interleave.RunAsync(db, gate,
            () => keypad.Register.AdjustLineAsync(draft.Id, lineId,
                new AdjustLineRequest { PlantCatalogId = sale.PlantId, NewQty = 2 }),
            () => scanner.Register.ScanIntoDraftAsync(draft.Id,
                new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "scan-2" }));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        // 1 scanned, adjusted up to 2, then one more scanned: 3 sold, 2 left.
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(3);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(2);
    }

    /// <summary>
    /// Was Inventories -> PlantCatalogs (adjust; the plant via the adjustment row's FK
    /// check) against PlantCatalogs -> Inventories (register).
    /// </summary>
    [PostgresFact]
    public async Task A_stock_correction_and_a_register_scan_of_the_same_plant_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var admin = db.NewStation("admin", gate, failures);
        await using var register = db.NewStation("register", failures: failures);
        var draft = await register.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });

        var result = await Interleave.RunAsync(db, gate,
            () => admin.Inventory.AdjustInventoryAsync(new AdjustInventoryRequest
            {
                PlantId = sale.PlantId,
                DeltaQty = 5,
                Reason = "Restock from greenhouse"
            }),
            () => register.Register.ScanIntoDraftAsync(draft.Id,
                new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "pos-1" }));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(9, "5 + 5 restocked - 1 sold");
    }

    /// <summary>
    /// Was Inventories -> OrderLines -> FulfillmentEvents -> PlantCatalogs (undo; the plant via
    /// the undo event's FK check) against PlantCatalogs -> Inventories -> OrderLines
    /// (<c>WalkUpRowLocks</c>, here through <c>WalkUpService.AddWalkUpLineAsync</c>).
    /// </summary>
    [PostgresFact]
    public async Task An_undo_and_a_walk_up_line_add_for_the_same_plant_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 1);
        var preorder = sale.OrderIds[0];

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var pickup = db.NewStation("undo", gate, failures);
        await using var walkUp = db.NewStation("walk-up", failures: failures);

        // A scan to undo, taken before the gate is armed for anything that matters: the gate
        // only ever holds the first matching command, so scan on a different station.
        await using (var setup = db.NewStation("setup"))
        {
            (await setup.Fulfillment.ScanAsync(preorder, sale.Barcode)).Result.Should().Be(FulfillmentResult.Accepted);
        }

        var walkUpOrder = await walkUp.WalkUp.CreateWalkUpOrderAsync(new CreateWalkUpOrderRequest { DisplayName = "Walk-in" });

        var result = await Interleave.RunAsync(db, gate,
            () => pickup.Fulfillment.UndoLastScanAsync(preorder, "wrong plant handed over", "station 2"),
            () => walkUp.WalkUp.AddWalkUpLineAsync(walkUpOrder.Id,
                new AddWalkUpLineRequest { PlantCatalogId = sale.PlantId, QtyOrdered = 1 }));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(5, "the undo put the scanned plant back");
        var lines = await db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.PlantCatalogId == sale.PlantId).ToListAsync());
        lines.Single(l => l.OrderId == preorder).QtyFulfilled.Should().Be(0);
        lines.Single(l => l.OrderId == walkUpOrder.Id).QtyOrdered.Should().Be(1);
    }

    /// <summary>
    /// Was request order: two bulk status changes naming the same orders in opposite
    /// orders. Held after locking its first order, the first request owns the second
    /// request's first order and wants its second.
    /// </summary>
    [PostgresFact]
    public async Task Two_bulk_status_changes_naming_the_same_orders_in_opposite_orders_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 1, 1);
        var (x, y) = (sale.OrderIds[0], sale.OrderIds[1]);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeOrderLock(occurrence: 2);
        await using var first = db.NewStation("bulk-1", gate, failures);
        await using var second = db.NewStation("bulk-2", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => first.Orders.BulkSetStatusAsync(
                new BulkSetOrderStatusRequest { OrderIds = new() { x, y }, TargetStatus = OrderStatus.InProgress }, "test"),
            () => second.Orders.BulkSetStatusAsync(
                new BulkSetOrderStatusRequest { OrderIds = new() { y, x }, TargetStatus = OrderStatus.Complete }, "test"));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        // The second request queued behind the first, so its status is the one left.
        var statuses = await db.QueryAsync(ctx => ctx.Orders.AsNoTracking()
            .Where(o => o.Id == x || o.Id == y).Select(o => o.Status).ToListAsync());
        statuses.Should().AllBeEquivalentTo(OrderStatus.Complete);
    }

    /// <summary>
    /// Was "lock the new plant only" (which, through <c>AcquireAsync</c>, also locked the
    /// order's lines on the new plant but not the line being moved). Two moves on one
    /// walk-up order, X from plant A to B and Y from B to A, each held the other's line
    /// and waited for its own. Both moves now lock both plants in ascending id.
    /// Covered through both routes that move a walk-up line.
    /// </summary>
    [PostgresTheory]
    [InlineData("walkup")]
    [InlineData("orders")]
    public async Task Two_walk_up_line_moves_swapping_plants_queue_instead_of_deadlocking(string route)
    {
        var db = await _pg.CreateDatabaseAsync();
        var plantA = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        var plantB = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        Guid orderId, lineX, lineY;
        await using (var setup = db.NewStation("setup"))
        {
            var order = await setup.WalkUp.CreateWalkUpOrderAsync(new CreateWalkUpOrderRequest { DisplayName = "Walk-in" });
            orderId = order.Id;
            lineX = (await setup.WalkUp.AddWalkUpLineAsync(orderId,
                new AddWalkUpLineRequest { PlantCatalogId = plantA.PlantId, QtyOrdered = 1 })).Id;
            lineY = (await setup.WalkUp.AddWalkUpLineAsync(orderId,
                new AddWalkUpLineRequest { PlantCatalogId = plantB.PlantId, QtyOrdered = 1 })).Id;
        }

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforeOrderLineWrite();
        await using var first = db.NewStation("move-x", gate, failures);
        await using var second = db.NewStation("move-y", failures: failures);

        Func<Station, Guid, Guid, Task<OrderLineResponse>> move = route == "walkup"
            ? (station, line, plant) => station.WalkUp.UpdateWalkUpLineAsync(orderId, line,
                new UpdateWalkUpLineRequest { PlantCatalogId = plant, QtyOrdered = 1 })
            : (station, line, plant) => station.Orders.UpdateLineAsync(orderId, line,
                new UpdateOrderLineRequest { PlantCatalogId = plant, QtyOrdered = 1 });

        var result = await Interleave.RunAsync(db, gate,
            () => move(first, lineX, plantB.PlantId),
            () => move(second, lineY, plantA.PlantId));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        var lines = await db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.OrderId == orderId).ToDictionaryAsync(l => l.Id, l => l.PlantCatalogId));
        lines[lineX].Should().Be(plantB.PlantId);
        lines[lineY].Should().Be(plantA.PlantId);
    }

    /// <summary>
    /// Was load order: each cancel locked plant -> inventory -> line per line in the order
    /// the lines came back. Two drafts that rang up the same two plants in opposite
    /// orders locked them in opposite orders. Held before its second plant lock, the
    /// first cancel owns the second cancel's second plant.
    /// </summary>
    [PostgresFact]
    public async Task Two_register_cancel_drafts_sharing_two_plants_queue_instead_of_deadlocking()
    {
        var db = await _pg.CreateDatabaseAsync();
        var plantA = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        var plantB = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        Guid draft1, draft2;
        await using (var setup = db.NewStation("setup"))
        {
            draft1 = (await setup.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" })).Id;
            draft2 = (await setup.Register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS2" })).Id;
            await setup.Register.ScanIntoDraftAsync(draft1, new ScanIntoDraftRequest { PlantBarcode = plantA.Barcode, ScanId = "d1-a" });
            await setup.Register.ScanIntoDraftAsync(draft1, new ScanIntoDraftRequest { PlantBarcode = plantB.Barcode, ScanId = "d1-b" });
            await setup.Register.ScanIntoDraftAsync(draft2, new ScanIntoDraftRequest { PlantBarcode = plantB.Barcode, ScanId = "d2-b" });
            await setup.Register.ScanIntoDraftAsync(draft2, new ScanIntoDraftRequest { PlantBarcode = plantA.Barcode, ScanId = "d2-a" });
        }

        (await SaleData.OnHandAsync(db, plantA.PlantId)).Should().Be(3);
        (await SaleData.OnHandAsync(db, plantB.PlantId)).Should().Be(3);

        var failures = new FailureLog();
        var gate = PauseBeforeCommand.BeforePlantLock(occurrence: 2);
        await using var first = db.NewStation("cancel-1", gate, failures);
        await using var second = db.NewStation("cancel-2", failures: failures);

        var result = await Interleave.RunAsync(db, gate,
            () => first.Register.CancelDraftAsync(draft1, "customer left"),
            () => second.Register.CancelDraftAsync(draft2, "customer left"));

        Report(result, failures);
        AssertQueuedWithoutDeadlock(result, failures);

        (await SaleData.OnHandAsync(db, plantA.PlantId)).Should().Be(5, "both cancels put their unit of A back");
        (await SaleData.OnHandAsync(db, plantB.PlantId)).Should().Be(5, "both cancels put their unit of B back");
    }

    private void AssertQueuedWithoutDeadlock<TA, TB>(InterleaveResult<TA, TB> result, FailureLog failures)
    {
        result.SecondWaitedOnLock.Should().BeTrue(
            "the second path touches the rows the first one holds, so it must queue behind it");
        failures.SqlStates.Should().NotContain("40P01",
            $"both paths take their locks in the canonical order; errors seen: {failures}");
        result.First.Succeeded.Should().BeTrue($"first: {result.First}");
        result.Second.Succeeded.Should().BeTrue($"second: {result.Second}");
    }

    private void Report<TA, TB>(InterleaveResult<TA, TB> result, FailureLog failures)
    {
        _output.WriteLine($"first: {result.First}");
        _output.WriteLine($"second: {result.Second}");
        _output.WriteLine($"second queued on a lock: {result.SecondWaitedOnLock}");
        _output.WriteLine($"Postgres errors (including retried ones): {failures}");
    }

    private static Task<Guid> LineIdAsync(PgTestDb db, Guid orderId, Guid plantId) =>
        db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.OrderId == orderId && l.PlantCatalogId == plantId)
            .Select(l => l.Id)
            .SingleAsync());

    private static async Task<Guid> SessionForAsync(PgTestDb db, Guid orderId)
    {
        var session = new ScanSession
        {
            EntityKind = ScanSessionEntityKind.AdHoc,
            WorkstationName = "Pickup 1",
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };
        session.Members.Add(new ScanSessionMember { OrderId = orderId });

        await db.ExecuteAsync(async ctx =>
        {
            ctx.ScanSessions.Add(session);
            await ctx.SaveChangesAsync();
        });

        return session.Id;
    }
}
