using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// Pick-list session scans against real Postgres: a repeated scan id is not
/// applied twice (replay query over the member orders, the partial unique
/// index on (OrderId, IdempotencyKey)), and a cancelled member order takes no
/// stock.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class SessionScanIntegrityTests
{
    private readonly PostgresFixture _pg;

    public SessionScanIntegrityTests(PostgresFixture pg) => _pg = pg;

    [PostgresFact]
    public async Task A_repeated_scan_id_in_a_session_fulfils_once()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 5, 1, 1);
        var sessionId = await SessionForAsync(db, sale.OrderIds);
        await using var station = db.NewStation("pickup");

        await station.Sessions.ScanInSessionAsync(sessionId, sale.Barcode, 1, "scan-a");
        var retry = await station.Sessions.ScanInSessionAsync(sessionId, sale.Barcode, 1, "scan-a");

        retry.Result.Should().Be(ScanSessionResult.Accepted);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(1);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(4);

        await station.Sessions.ScanInSessionAsync(sessionId, sale.Barcode, 1, "scan-b");
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(2);
    }

    [PostgresFact]
    public async Task A_one_scan_split_over_two_lines_of_one_order_commits()
    {
        // Only the first event of a split scan carries the id, so the unique
        // (OrderId, IdempotencyKey) index does not reject the second line.
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 5, 1);
        await db.ExecuteAsync(async ctx =>
        {
            ctx.OrderLines.Add(new OrderLine { OrderId = sale.OrderIds[0], PlantCatalogId = sale.PlantId, QtyOrdered = 1 });
            await ctx.SaveChangesAsync();
        });
        var sessionId = await SessionForAsync(db, sale.OrderIds);
        await using var station = db.NewStation("pickup");

        var result = await station.Sessions.ScanInSessionAsync(sessionId, sale.Barcode, 2, "split");

        result.Result.Should().Be(ScanSessionResult.Accepted);
        (await SaleData.TotalFulfilledAsync(db, sale.PlantId)).Should().Be(2);
    }

    [PostgresFact]
    public async Task A_cancelled_member_order_takes_no_stock()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, 5, 1);
        var sessionId = await SessionForAsync(db, sale.OrderIds);
        await db.ExecuteAsync(async ctx =>
        {
            var order = await ctx.Orders.SingleAsync(o => o.Id == sale.OrderIds[0]);
            order.Status = OrderStatus.Cancelled;
            await ctx.SaveChangesAsync();
        });
        await using var station = db.NewStation("pickup");

        var result = await station.Sessions.ScanInSessionAsync(sessionId, sale.Barcode, 1, "cancelled");

        result.Result.Should().Be(ScanSessionResult.NotInSession);
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(5);
    }

    private static async Task<Guid> SessionForAsync(PgTestDb db, IEnumerable<Guid> orderIds)
    {
        var session = new ScanSession
        {
            EntityKind = ScanSessionEntityKind.AdHoc,
            WorkstationName = "Pickup 1",
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };
        foreach (var id in orderIds) session.Members.Add(new ScanSessionMember { OrderId = id });
        await db.ExecuteAsync(async ctx =>
        {
            ctx.ScanSessions.Add(session);
            await ctx.SaveChangesAsync();
        });
        return session.Id;
    }
}
