using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Helpers;

/// <summary>
/// An <see cref="AppDbContext"/> over SQLite, for the constraints that
/// <see cref="MockDbContextFactory"/> cannot see.
///
/// The InMemory provider enforces no unique index, no filtered index, no check
/// constraint and no foreign key, and its factory additionally silences
/// <c>TransactionIgnoredWarning</c>. That is how a filtered unique index on
/// <c>PicklistBarcode</c> could ship with no code assigning one: the first row
/// stored <c>""</c>, the second collided, and 525 tests said nothing. Fixing
/// that under the same provider would have left the fix equally unverified.
///
/// SQLite creates the schema from the same model -- unique indexes, partial
/// indexes (`CREATE UNIQUE INDEX ... WHERE "DeletedAt" IS NULL`) and check
/// constraints included -- and enforces all three.
///
/// What it is NOT: it is not Postgres. It does not exercise `SELECT ... FOR
/// UPDATE` (SQLite has no row locks), SERIALIZABLE retry behaviour, 23505 error
/// codes, `jsonb` semantics, or collation. Tests about those still need a real
/// server; see the E2E harness in `docs/improve/2026-08-29-sweep-report.md`.
/// This closes the constraint-shaped hole, not the whole gap.
/// </summary>
public sealed class ConstraintEnforcingDbContext : IDisposable
{
    private readonly SqliteConnection _connection;

    public AppDbContext Db { get; }

    public ConstraintEnforcingDbContext()
    {
        // A ":memory:" database lives for exactly as long as its connection, so
        // the connection is owned here and kept open for the context's lifetime.
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;

        Db = new AppDbContext(options);
        Db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}
