using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// <c>WalkUpRowLocks.IsRetryableConcurrencyFailure</c> decides whether a failed station
/// write is retried or shown to the volunteer, and <c>WalkUpOrderNumbers.IsUniqueViolation</c>
/// decides whether a register picks the next order number. The unit tests feed them
/// hand-built exceptions. These feed them what Postgres, Npgsql and EF actually throw,
/// provoked for real, in each place the services can meet them.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class PostgresErrorClassificationTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public PostgresErrorClassificationTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [PostgresFact]
    public async Task Serialization_failure_raised_by_SELECT_FOR_UPDATE_is_retryable()
    {
        // The shape the scan path meets first: its FOR UPDATE finds the row changed since
        // its snapshot, and the raw SQL call throws with no EF wrapper around it.
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        await using var loser = db.NewContext();
        await using var tx = await loser.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        await loser.Inventories.AsNoTracking().SingleAsync(i => i.PlantCatalogId == sale.PlantId); // takes the snapshot

        await BumpStockOutsideAsync(db, sale.PlantId);

        var ex = await Capture(() => loser.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} FOR UPDATE", sale.PlantId));

        AssertSqlState(ex, "40001");
        WalkUpRowLocks.IsRetryableConcurrencyFailure(ex).Should().BeTrue();
        WalkUpOrderNumbers.IsUniqueViolation(ex).Should().BeFalse();
    }

    [PostgresFact]
    public async Task Serialization_failure_raised_by_SaveChanges_is_retryable()
    {
        // The shape when the conflict is found at the write: EF wraps it in DbUpdateException.
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        await using var loser = db.NewContext();
        await using var tx = await loser.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        var inventory = await loser.Inventories.SingleAsync(i => i.PlantCatalogId == sale.PlantId);

        await BumpStockOutsideAsync(db, sale.PlantId);

        inventory.OnHandQty -= 1;
        var ex = await Capture(() => loser.SaveChangesAsync());

        ex.Should().BeAssignableTo<DbUpdateException>();
        AssertSqlState(ex, "40001");
        WalkUpRowLocks.IsRetryableConcurrencyFailure(ex).Should().BeTrue();
    }

    [PostgresFact]
    public async Task Serialization_failure_from_a_read_write_dependency_is_retryable()
    {
        // The failure only SERIALIZABLE produces: no row was written twice, but each
        // transaction read what the other wrote (write skew). FOR UPDATE alone never
        // raises this; it is the serializable isolation doing its job.
        var db = await _pg.CreateDatabaseAsync();
        var x = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        var y = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        await using var first = db.NewContext();
        await using var second = db.NewContext();
        await using var tx1 = await first.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        await using var tx2 = await second.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);

        await SumStockAsync(first, x.PlantId, y.PlantId);
        await SumStockAsync(second, x.PlantId, y.PlantId);

        // Postgres may abort the second writer as soon as it writes ("canceled on
        // identification as a pivot, during write") or let it run and refuse its commit.
        // Either is legitimate; what matters is how the error is classified.
        var step = "";
        var ex = await CaptureOrNull(async () =>
        {
            step = "first UPDATE";
            await first.Database.ExecuteSqlRawAsync(
                "UPDATE \"Inventories\" SET \"OnHandQty\" = \"OnHandQty\" - 1 WHERE \"PlantCatalogId\" = {0}", x.PlantId);
            step = "second UPDATE";
            await second.Database.ExecuteSqlRawAsync(
                "UPDATE \"Inventories\" SET \"OnHandQty\" = \"OnHandQty\" - 1 WHERE \"PlantCatalogId\" = {0}", y.PlantId);
            step = "first COMMIT";
            await tx1.CommitAsync();
            step = "second COMMIT";
            await tx2.CommitAsync();
        });

        ex.Should().NotBeNull("two serializable transactions that each read what the other wrote cannot both commit");
        _output.WriteLine($"aborted at: {step}");
        AssertSqlState(ex!, "40001");
        WalkUpRowLocks.IsRetryableConcurrencyFailure(ex!).Should().BeTrue();
    }

    [PostgresFact]
    public async Task Deadlock_is_retryable()
    {
        // Two writers taking the same two row locks in opposite orders. Postgres breaks the
        // cycle after deadlock_timeout by aborting one of them with 40P01.
        var db = await _pg.CreateDatabaseAsync();
        var x = await SaleData.PlantWithOrdersAsync(db, onHand: 5);
        var y = await SaleData.PlantWithOrdersAsync(db, onHand: 5);

        await using var one = db.NewContext();
        await using var two = db.NewContext();
        await using var tx1 = await one.Database.BeginTransactionAsync();
        await using var tx2 = await two.Database.BeginTransactionAsync();

        await LockAsync(one, x.PlantId);
        await LockAsync(two, y.PlantId);

        var crossed = await Task.WhenAll(
            Task.Run(() => CaptureOrNull(() => LockAsync(one, y.PlantId))),
            Task.Run(() => CaptureOrNull(() => LockAsync(two, x.PlantId))))
            .WaitAsync(TimeSpan.FromSeconds(30));

        var failures = crossed.Where(e => e != null).ToList();
        failures.Should().ContainSingle("Postgres aborts exactly one side of a deadlock");

        var ex = failures.Single()!;
        AssertSqlState(ex, "40P01");
        WalkUpRowLocks.IsRetryableConcurrencyFailure(ex).Should().BeTrue();
    }

    [PostgresFact]
    public async Task Unique_violation_is_recognised_and_is_not_treated_as_a_retryable_conflict()
    {
        var db = await _pg.CreateDatabaseAsync();

        await using var ctx = db.NewContext();
        ctx.Orders.Add(new Order { OrderNumber = "WLK-00001", IsWalkUp = true, Status = OrderStatus.Draft });
        await ctx.SaveChangesAsync();
        ctx.ChangeTracker.Clear();

        ctx.Orders.Add(new Order { OrderNumber = "WLK-00001", IsWalkUp = true, Status = OrderStatus.Draft });
        var ex = await Capture(() => ctx.SaveChangesAsync());

        ex.Should().BeAssignableTo<DbUpdateException>();
        AssertSqlState(ex, "23505");
        WalkUpOrderNumbers.IsUniqueViolation(ex).Should().BeTrue();

        // Retrying a duplicate key as if it were a transient conflict would just fail the
        // same way six times and then surface anyway.
        WalkUpRowLocks.IsRetryableConcurrencyFailure(ex).Should().BeFalse();
    }

    [PostgresFact]
    public async Task Check_and_foreign_key_violations_are_neither_unique_violations_nor_retryable()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 5, 1);

        await using var ctx = db.NewContext();

        // CK_OrderLine_QtyFulfilled_LessEqual_QtyOrdered
        var line = await ctx.OrderLines.SingleAsync(l => l.OrderId == sale.OrderIds[0]);
        line.QtyFulfilled = line.QtyOrdered + 1;
        var check = await Capture(() => ctx.SaveChangesAsync());
        AssertSqlState(check, "23514");
        ctx.ChangeTracker.Clear();

        // Line pointing at an order that does not exist.
        ctx.OrderLines.Add(new OrderLine { OrderId = Guid.NewGuid(), PlantCatalogId = sale.PlantId, QtyOrdered = 1 });
        var foreignKey = await Capture(() => ctx.SaveChangesAsync());
        AssertSqlState(foreignKey, "23503");

        foreach (var ex in new[] { check, foreignKey })
        {
            WalkUpOrderNumbers.IsUniqueViolation(ex).Should().BeFalse();
            WalkUpRowLocks.IsRetryableConcurrencyFailure(ex).Should().BeFalse();
        }
    }

    private void AssertSqlState(Exception ex, string expected)
    {
        var chain = new List<string>();
        for (var current = ex; current != null; current = current.InnerException)
            chain.Add(current is PostgresException p ? $"PostgresException({p.SqlState})" : current.GetType().Name);
        _output.WriteLine($"thrown: {string.Join(" -> ", chain)}");

        var pg = FindPostgresException(ex);
        pg.Should().NotBeNull($"expected a PostgresException somewhere in {string.Join(" -> ", chain)}");
        pg!.SqlState.Should().Be(expected, pg.MessageText);
    }

    private static PostgresException? FindPostgresException(Exception ex)
    {
        for (var current = ex; current != null; current = current.InnerException)
            if (current is PostgresException pg) return pg;
        return null;
    }

    private static async Task<Exception> Capture(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception ex)
        {
            return ex;
        }

        throw new Xunit.Sdk.XunitException("Expected Postgres to reject this, but it succeeded.");
    }

    private static async Task<Exception?> CaptureOrNull(Func<Task> action)
    {
        try
        {
            await action();
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    private static Task BumpStockOutsideAsync(PgTestDb db, Guid plantId) =>
        db.ExecuteAsync(ctx => ctx.Database.ExecuteSqlRawAsync(
            "UPDATE \"Inventories\" SET \"OnHandQty\" = \"OnHandQty\" + 1 WHERE \"PlantCatalogId\" = {0}", plantId));

    private static Task<int> SumStockAsync(AppDbContext ctx, Guid a, Guid b) =>
        ctx.Inventories.AsNoTracking()
            .Where(i => i.PlantCatalogId == a || i.PlantCatalogId == b)
            .SumAsync(i => i.OnHandQty);

    private static Task<int> LockAsync(AppDbContext ctx, Guid plantId) =>
        ctx.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} FOR UPDATE", plantId);
}
