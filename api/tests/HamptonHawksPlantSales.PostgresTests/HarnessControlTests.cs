using FluentAssertions;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit.Abstractions;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// The race tests in this project pass when the code under test prevents an oversell.
/// That only means something if the harness really does put two transactions inside
/// each other; if it quietly ran them one after the other, every race test would pass
/// against code with no locking at all.
///
/// This is the control: the same harness, driving a plain read-modify-write with no lock
/// and default isolation, must reproduce the lost update the service code exists to
/// prevent.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class HarnessControlTests
{
    private readonly PostgresFixture _pg;
    private readonly ITestOutputHelper _output;

    public HarnessControlTests(PostgresFixture pg, ITestOutputHelper output)
    {
        _pg = pg;
        _output = output;
    }

    [PostgresFact]
    public async Task Two_unlocked_read_modify_writes_really_do_lose_an_update_under_the_harness()
    {
        var db = await _pg.CreateDatabaseAsync();
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 10);
        _output.WriteLine($"PostgreSQL {_pg.ServerVersion}");

        var gate = PauseBeforeCommand.BeforeInventoryWrite();
        await using var a = db.NewStation("A", gate);
        await using var b = db.NewStation("B");

        var result = await Interleave.RunAsync(db, gate,
            () => UnlockedIncrementAsync(a.Db, sale.PlantId),
            () => UnlockedIncrementAsync(b.Db, sale.PlantId));

        _output.WriteLine($"A: {result.First}; B: {result.Second}; B waited on a lock: {result.SecondWaitedOnLock}");

        result.First.Succeeded.Should().BeTrue();
        result.Second.Succeeded.Should().BeTrue();
        result.SecondWaitedOnLock.Should().BeFalse("nothing in the unlocked version takes a lock B could wait for");

        // Two increments ran and both committed, but the stock only moved by one.
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(11,
            "the harness must interleave the two transactions; if this is 12 they ran one after the other " +
            "and none of the race tests in this project prove anything");
    }

    /// <summary>What the stock write looks like with the protection stripped away.</summary>
    private static async Task<int> UnlockedIncrementAsync(AppDbContext db, Guid plantId)
    {
        await using var tx = await db.Database.BeginTransactionAsync(); // READ COMMITTED, no FOR UPDATE
        var inventory = await db.Inventories.SingleAsync(i => i.PlantCatalogId == plantId);
        inventory.OnHandQty += 1;
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return inventory.OnHandQty;
    }
}
