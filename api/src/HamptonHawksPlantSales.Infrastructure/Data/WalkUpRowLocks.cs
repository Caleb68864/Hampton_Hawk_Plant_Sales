using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace HamptonHawksPlantSales.Infrastructure.Data;

/// <summary>
/// Row-locking helpers for the walk-up write paths.
///
/// Walk-up availability is a read-then-write invariant: AvailableForWalkup is derived
/// from inventory and outstanding preorder lines, so validating it outside a lock lets
/// two registers both pass the check for the last unit and both commit. Every walk-up
/// write must therefore open a serializable transaction, take the row locks, and only
/// then validate.
///
/// Locks are always acquired in the same order (PlantCatalogs, Inventories, OrderLines)
/// so concurrent walk-up writes queue instead of deadlocking. Non-relational providers
/// (the InMemory provider used by the unit tests) support neither transactions nor
/// FOR UPDATE, so both helpers degrade to no-ops there.
/// </summary>
public static class WalkUpRowLocks
{
    /// <summary>
    /// Opens the serializable transaction guarding a walk-up write, or returns null on
    /// providers that do not support transactions.
    /// </summary>
    public static async Task<IDbContextTransaction?> BeginAsync(AppDbContext db)
    {
        if (!db.Database.IsRelational()) return null;

        return await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable);
    }

    /// <summary>
    /// Takes exclusive row locks on the plant, its inventory row, and the order's line
    /// for that plant. Safe to call when no transaction is open (no-op on InMemory).
    /// </summary>
    public static async Task AcquireAsync(AppDbContext db, Guid plantCatalogId, Guid orderId)
    {
        if (!db.Database.IsRelational()) return;

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"PlantCatalogs\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
            plantCatalogId);

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
            plantCatalogId);

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"OrderLines\" WHERE \"OrderId\" = {0} AND \"PlantCatalogId\" = {1} AND \"DeletedAt\" IS NULL FOR UPDATE",
            orderId, plantCatalogId);
    }

    /// <summary>
    /// Runs a walk-up write, retrying when Postgres aborts the transaction with a
    /// serialization failure or deadlock. Under serializable isolation these are
    /// expected whenever two registers touch the same plant, and they are safe to
    /// retry because the aborted transaction committed nothing. Without this the
    /// volunteer sees "a transient failure has been raised" and has no idea whether
    /// the sale went through.
    /// </summary>
    /// <summary>
    /// Rolls back without letting a rollback failure mask the original error. Once
    /// Postgres aborts a transaction the rollback itself can throw, and that
    /// secondary exception carries none of the cause -- losing it turns a
    /// retryable serialization conflict into an opaque failure.
    /// </summary>
    public static async Task RollbackQuietlyAsync(IDbContextTransaction? transaction)
    {
        if (transaction == null) return;

        try
        {
            await transaction.RollbackAsync();
        }
        catch
        {
            // The transaction is already dead; the original exception is what matters.
        }
    }

    public static async Task<T> ExecuteWithRetryAsync<T>(AppDbContext db, Func<Task<T>> action, int maxAttempts = 6)
    {
        for (var attempt = 1; attempt < maxAttempts; attempt++)
        {
            try
            {
                return await action();
            }
            catch (Exception ex) when (IsRetryableConcurrencyFailure(ex))
            {
                db.ChangeTracker.Clear();

                // Back off with jitter before retrying. Without it, every station that
                // lost the last round retries in lockstep and collides again -- measured
                // on 8 concurrent registers, straight retries kept aborting until the
                // attempt budget ran out.
                var backoffMs = (attempt * 20) + Random.Shared.Next(0, 30);
                await Task.Delay(backoffMs);
            }
        }

        // Final attempt is unguarded so a persistent failure surfaces rather than looping.
        return await action();
    }

    /// <summary>
    /// True when <paramref name="exception"/> is (or wraps) a Postgres serialization
    /// failure, deadlock, or other transient failure that is safe to retry.
    /// </summary>
    public static bool IsRetryableConcurrencyFailure(Exception exception)
    {
        return true; // MUTATION
#pragma warning disable CS0162
        for (var current = exception; current != null; current = current.InnerException)
        {
            // SQLSTATE is the authoritative signal: 40001 serialization_failure,
            // 40P01 deadlock_detected. Npgsql wraps these in an NpgsqlException whose
            // own message ("...likely due to a transient failure") says nothing about
            // the cause, so inspect the PostgresException rather than the wrapper.
            if (current is PostgresException pg && (pg.SqlState == "40001" || pg.SqlState == "40P01"))
                return true;

            // Npgsql marks transient failures explicitly; trust that flag too, since
            // the retry is safe either way (the aborted transaction committed nothing).
            if (current is NpgsqlException { IsTransient: true })
                return true;

            var message = current.Message;
            if (message.Contains("could not serialize access", StringComparison.OrdinalIgnoreCase)
                || message.Contains("deadlock detected", StringComparison.OrdinalIgnoreCase)
                || message.Contains("concurrent update", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
#pragma warning restore CS0162
    }
}
