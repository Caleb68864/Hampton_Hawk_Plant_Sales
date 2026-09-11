using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

/// <summary>One freshly migrated database, private to a single test.</summary>
public sealed class PgTestDb
{
    public PgTestDb(string connectionString) => ConnectionString = connectionString;

    public string ConnectionString { get; }

    public AppDbContext NewContext(params IInterceptor[] interceptors) =>
        PostgresFixture.CreateContext(ConnectionString, interceptors);

    /// <summary>
    /// A checkout station: its own DbContext, so its own connection and its own
    /// transactions, exactly like a second browser hitting the API.
    /// </summary>
    public Station NewStation(string name, PauseBeforeCommand? gate = null, FailureLog? failures = null)
    {
        var log = failures ?? new FailureLog();
        var interceptors = new List<IInterceptor> { new CommandFailureRecorder(log, name), new TransactionFailureRecorder(log, name) };
        if (gate != null) interceptors.Add(gate);
        return new Station(name, NewContext(interceptors.ToArray()), log);
    }

    public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        await using var db = NewContext();
        return await query(db);
    }

    public async Task ExecuteAsync(Func<AppDbContext, Task> work)
    {
        await using var db = NewContext();
        await work(db);
    }

    /// <summary>
    /// Number of backends in this database currently waiting to acquire a lock. This is
    /// how a test knows the second station really is queued behind the first one's row
    /// lock, rather than assuming it from timing.
    /// </summary>
    public async Task<int> SessionsWaitingOnLocksAsync()
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT count(*)::int FROM pg_stat_activity " +
            "WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()",
            conn);
        return (int)(await cmd.ExecuteScalarAsync())!;
    }
}

public sealed class Station : IAsyncDisposable
{
    private static readonly IConfiguration EmptyConfiguration = new ConfigurationBuilder().Build();

    public Station(string name, AppDbContext db, FailureLog failures)
    {
        Name = name;
        Db = db;
        Failures = failures;
    }

    public string Name { get; }
    public AppDbContext Db { get; }
    public FailureLog Failures { get; }

    public FulfillmentService Fulfillment => new(Db, new AdminService(Db));
    public InventoryService Inventory => new(Db);
    public WalkUpRegisterService Register =>
        new(Db, new InventoryProtectionService(Db), new AdminService(Db), EmptyConfiguration);

    public ValueTask DisposeAsync() => Db.DisposeAsync();
}
