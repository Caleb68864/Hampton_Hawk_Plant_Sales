using System.Collections.Concurrent;
using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.PostgresTests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HamptonHawksPlantSales.PostgresTests;

/// <summary>
/// A refused register scan is a normal 400. It used to log an EF Core Error,
/// "An error occurred using a transaction", on every refusal: the refusal branch
/// rolled back and threw, and the catch-all rolled the same, now completed
/// transaction back a second time. Npgsql rejects that, EF logs the rejection
/// at Error under <c>Microsoft.EntityFrameworkCore.Database.Transaction</c>, and
/// <c>RollbackQuietlyAsync</c> swallowed the exception -- but not the log line.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class RefusedScanLoggingTests
{
    private const string TransactionCategory = "Microsoft.EntityFrameworkCore.Database.Transaction";

    private static readonly IConfiguration Configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = Station.AdminPin })
        .Build();

    private readonly PostgresFixture _pg;

    public RefusedScanLoggingTests(PostgresFixture pg) => _pg = pg;

    [PostgresFact]
    public async Task A_scan_refused_over_walk_up_availability_rolls_back_without_an_error_log()
    {
        var db = await _pg.CreateDatabaseAsync();
        // 2 on hand, both promised to a preorder: walk-up availability is 0.
        var sale = await SaleData.PlantWithOrdersAsync(db, onHand: 2, 2);

        var logs = new CapturedLogs();
        await using var ctx = NewLoggedContext(db, logs);
        var register = new WalkUpRegisterService(ctx, new InventoryProtectionService(ctx), new AdminService(ctx), Configuration);
        var draft = await register.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "POS1" });
        logs.Clear();

        var refused = () => register.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = sale.Barcode, ScanId = "over-availability" });
        await refused.Should().ThrowAsync<ValidationException>();

        logs.Errors.Should().BeEmpty("a refused scan is a normal 400, not a database failure");
        (await SaleData.OnHandAsync(db, sale.PlantId)).Should().Be(2, "the refusal rolled back");

        // The connection is left usable: the next, permitted scan on the same context works.
        var unknown = () => register.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "NO-SUCH-PLANT", ScanId = "unknown" });
        await unknown.Should().ThrowAsync<ValidationException>();
        logs.Errors.Should().BeEmpty("an unknown barcode is refused the same way");
    }

    /// <summary>
    /// Control: the capture really sees this category at Error, and a real failure in it
    /// still logs. Rolling back a completed transaction is the exact misuse the refusal
    /// path used to commit.
    /// </summary>
    [PostgresFact]
    public async Task Control_a_real_transaction_failure_still_logs_at_error()
    {
        var db = await _pg.CreateDatabaseAsync();
        var logs = new CapturedLogs();
        await using var ctx = NewLoggedContext(db, logs);

        await using var tx = await ctx.Database.BeginTransactionAsync();
        await tx.RollbackAsync();
        var second = () => tx.RollbackAsync();
        await second.Should().ThrowAsync<InvalidOperationException>();

        logs.Errors.Should().Contain(e => e.Category == TransactionCategory);
    }

    /// <summary>
    /// Control: a database command that fails inside a walk-up transaction is not hidden
    /// by the quiet rollback either.
    /// </summary>
    [PostgresFact]
    public async Task Control_a_failing_command_inside_the_transaction_still_logs_at_error()
    {
        var db = await _pg.CreateDatabaseAsync();
        var logs = new CapturedLogs();
        await using var ctx = NewLoggedContext(db, logs);

        var tx = await ctx.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
        try
        {
            var bad = () => ctx.Database.ExecuteSqlRawAsync("SELECT * FROM \"NoSuchTable\"");
            await bad.Should().ThrowAsync<Exception>();
        }
        finally
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(tx);
            await tx.DisposeAsync();
        }

        logs.Errors.Should().NotBeEmpty("a real database failure must stay visible");
    }

    private static AppDbContext NewLoggedContext(PgTestDb db, CapturedLogs logs)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(db.ConnectionString)
            .UseLoggerFactory(LoggerFactory.Create(b => b.SetMinimumLevel(LogLevel.Trace).AddProvider(logs)))
            .Options;
        return new AppDbContext(options);
    }

    private sealed record LogEntry(string Category, LogLevel Level, string Message);

    private sealed class CapturedLogs : ILoggerProvider
    {
        private readonly ConcurrentQueue<LogEntry> _entries = new();

        public IReadOnlyList<LogEntry> Errors =>
            _entries.Where(e => e.Level >= LogLevel.Error).ToList();

        public void Clear() => _entries.Clear();

        public ILogger CreateLogger(string categoryName) => new Logger(categoryName, _entries);

        public void Dispose() { }

        private sealed class Logger(string category, ConcurrentQueue<LogEntry> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
                Func<TState, Exception?, string> formatter) =>
                entries.Enqueue(new LogEntry(category, logLevel, formatter(state, exception)));
        }
    }
}
