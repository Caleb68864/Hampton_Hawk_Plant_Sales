namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

/// <summary>What one racing operation ended with: a value, or the exception it threw.</summary>
public sealed class Outcome<T>
{
    private Outcome(T? value, Exception? error)
    {
        Value = value;
        Error = error;
    }

    public T? Value { get; }
    public Exception? Error { get; }
    public bool Succeeded => Error == null;

    public static async Task<Outcome<T>> CaptureAsync(Task<T> task)
    {
        try
        {
            return new Outcome<T>(await task, null);
        }
        catch (Exception ex)
        {
            return new Outcome<T>(default, ex);
        }
    }

    public override string ToString() => Succeeded ? $"ok: {Value}" : $"threw {Error!.GetType().Name}: {Error.Message}";
}

public sealed record InterleaveResult<TFirst, TSecond>(
    Outcome<TFirst> First,
    Outcome<TSecond> Second,
    bool SecondWaitedOnLock);

/// <summary>
/// Runs two operations so that their transactions genuinely overlap:
///
///   1. <c>first</c> runs until it is about to send the command the gate watches for
///      (typically the write-back of the stock it has just read), and is held there
///      with its transaction open and any row locks it took still held;
///   2. <c>second</c> runs until it either finishes or is observed in
///      <c>pg_stat_activity</c> waiting on a lock -- that is, queued behind the first;
///   3. <c>first</c> is released and both are allowed to finish.
///
/// If the code under test takes no lock, step 2 lets <c>second</c> commit inside
/// <c>first</c>'s read-modify-write, which is exactly the interleaving that oversells.
/// If it does lock, <c>second</c> queues and only sees the stock after <c>first</c> is done.
/// Either way the overlap is forced, not left to timing.
/// </summary>
public static class Interleave
{
    private static readonly TimeSpan StepTimeout = TimeSpan.FromSeconds(30);

    public static async Task<InterleaveResult<TFirst, TSecond>> RunAsync<TFirst, TSecond>(
        PgTestDb db,
        PauseBeforeCommand gate,
        Func<Task<TFirst>> first,
        Func<Task<TSecond>> second)
    {
        var firstTask = Task.Run(first);

        var arrived = await Task.WhenAny(gate.Reached, firstTask).WaitAsync(StepTimeout);
        if (arrived != gate.Reached)
        {
            var early = await Outcome<TFirst>.CaptureAsync(firstTask);
            throw new InvalidOperationException(
                $"The first operation finished ({early}) without reaching the gate ({gate.Description}). " +
                "The gate no longer matches the code path under test, so the race was never staged.");
        }

        var secondTask = Task.Run(second);
        var secondWaitedOnLock = await WaitUntilWaitingOnLockOrFinishedAsync(db, secondTask);

        gate.Release();

        var firstOutcome = await Outcome<TFirst>.CaptureAsync(firstTask.WaitAsync(StepTimeout));
        var secondOutcome = await Outcome<TSecond>.CaptureAsync(secondTask.WaitAsync(StepTimeout));

        return new InterleaveResult<TFirst, TSecond>(firstOutcome, secondOutcome, secondWaitedOnLock);
    }

    private static async Task<bool> WaitUntilWaitingOnLockOrFinishedAsync(PgTestDb db, Task secondTask)
    {
        var deadline = DateTime.UtcNow + StepTimeout;
        while (DateTime.UtcNow < deadline)
        {
            if (secondTask.IsCompleted) return false;
            if (await db.SessionsWaitingOnLocksAsync() > 0) return true;
            await Task.Delay(20);
        }

        throw new TimeoutException(
            "The second operation neither finished nor queued on a lock within " + StepTimeout.TotalSeconds + "s.");
    }
}
