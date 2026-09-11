using System.Collections.Concurrent;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

/// <summary>
/// Holds the first command whose SQL matches until the test releases it. Used to stop a
/// station at the exact point where it has read the stock and is about to write it back,
/// so a second station can be run into the gap. That makes the overlap between the two
/// transactions certain instead of a matter of luck with timing.
/// </summary>
public sealed class PauseBeforeCommand : DbCommandInterceptor
{
    private static readonly TimeSpan MaxPause = TimeSpan.FromSeconds(60);

    private readonly Func<string, bool> _matches;
    private readonly TaskCompletionSource _reached = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _used;

    public PauseBeforeCommand(string description, Func<string, bool> matches)
    {
        Description = description;
        _matches = matches;
    }

    /// <summary>Pause before the first write-back of an inventory row.</summary>
    public static PauseBeforeCommand BeforeInventoryWrite() =>
        new("before UPDATE \"Inventories\"", sql => sql.Contains("UPDATE \"Inventories\"", StringComparison.Ordinal));

    /// <summary>Pause before the first insert of an order row.</summary>
    public static PauseBeforeCommand BeforeOrderInsert() =>
        new("before INSERT INTO \"Orders\"", sql => sql.Contains("INSERT INTO \"Orders\"", StringComparison.Ordinal));

    public string Description { get; }
    public Task Reached => _reached.Task;
    public void Release() => _release.TrySetResult();

    private async ValueTask PauseIfMatchAsync(DbCommand command, CancellationToken cancellationToken)
    {
        if (!_matches(command.CommandText)) return;
        if (Interlocked.Exchange(ref _used, 1) == 1) return; // only ever the first match; retries run free

        _reached.TrySetResult();
        await _release.Task.WaitAsync(MaxPause, cancellationToken);
    }

    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        await PauseIfMatchAsync(command, cancellationToken);
        return result;
    }

    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        await PauseIfMatchAsync(command, cancellationToken);
        return result;
    }

    public override async ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<object> result,
        CancellationToken cancellationToken = default)
    {
        await PauseIfMatchAsync(command, cancellationToken);
        return result;
    }
}

/// <summary>
/// Every Postgres error a station hit, including the ones its retry loop swallowed. A
/// test that claims "the retry absorbed a serialization failure" has to be able to show
/// that a serialization failure actually happened.
/// </summary>
public sealed class FailureLog
{
    private readonly ConcurrentQueue<(string Station, string SqlState)> _entries = new();

    public void Add(string station, Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException pg)
            {
                _entries.Enqueue((station, pg.SqlState));
                return;
            }
        }
    }

    public IReadOnlyList<(string Station, string SqlState)> Entries => _entries.ToList();

    public IReadOnlyList<string> SqlStates => _entries.Select(e => e.SqlState).ToList();

    public override string ToString() =>
        _entries.IsEmpty ? "(none)" : string.Join(", ", _entries.Select(e => $"{e.Station}:{e.SqlState}"));
}

public sealed class CommandFailureRecorder : DbCommandInterceptor
{
    private readonly FailureLog _log;
    private readonly string _station;

    public CommandFailureRecorder(FailureLog log, string station)
    {
        _log = log;
        _station = station;
    }

    public override void CommandFailed(DbCommand command, CommandErrorEventData eventData) =>
        _log.Add(_station, eventData.Exception);

    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _log.Add(_station, eventData.Exception);
        return Task.CompletedTask;
    }
}

public sealed class TransactionFailureRecorder : DbTransactionInterceptor
{
    private readonly FailureLog _log;
    private readonly string _station;

    public TransactionFailureRecorder(FailureLog log, string station)
    {
        _log = log;
        _station = station;
    }

    public override void TransactionFailed(DbTransaction transaction, TransactionErrorEventData eventData) =>
        _log.Add(_station, eventData.Exception);

    public override Task TransactionFailedAsync(DbTransaction transaction, TransactionErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _log.Add(_station, eventData.Exception);
        return Task.CompletedTask;
    }
}
