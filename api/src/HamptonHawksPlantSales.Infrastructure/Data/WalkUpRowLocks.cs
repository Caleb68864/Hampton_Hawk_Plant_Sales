using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace HamptonHawksPlantSales.Infrastructure.Data;

/// <summary>
/// Row-locking helpers for every stock write path, and the one place the lock order is
/// defined. (The name predates the other callers: it started with the walk-up paths.)
///
/// Walk-up availability is a read-then-write invariant: AvailableForWalkup is derived
/// from inventory and outstanding preorder lines, so validating it outside a lock lets
/// two registers both pass the check for the last unit and both commit. Every walk-up
/// write must therefore open a serializable transaction, take the row locks, and only
/// then validate.
///
/// CANONICAL LOCK ORDER. Every path that writes stock, order lines or fulfillment
/// events takes its row locks in this order, and only ever forward:
///
///   1. ScanSessions -- the session row, when the write is a session scan.
///   2. Per plant, in ascending PlantCatalogId:
///        a. PlantCatalogs  (the plant row)
///        b. Inventories    (that plant's stock row)
///        c. OrderLines     (that plant's lines being written, ascending Id)
///   3. Orders (ascending Id).
///   4. FulfillmentEvents.
///
/// "Ascending" means as .NET orders Guids (<c>OrderBy(id => id)</c>), which is not
/// Postgres's uuid order. It only has to be the same order in every caller, so always
/// sort in C# through these helpers rather than with ORDER BY in SQL.
///
/// The plant row is the per-plant mutex: once a path holds it, nobody else can be
/// half-way into that plant's inventory or lines. Implicit locks count as well:
/// inserting an OrderLine, FulfillmentEvent or InventoryAdjustment takes FOR KEY SHARE
/// on the referenced plant (and order) for the foreign key check, and updating
/// BarcodeLockedAt locks the plant row. A path that locked only Inventories and then
/// inserted an event was really taking Inventories -> PlantCatalogs, and deadlocked
/// against a register holding the plant and waiting for the stock row. So: take the
/// plant lock first (<see cref="LockPlantAsync"/>), even when the plant row itself is
/// not written. When the plant is only known from a row that has not been locked yet
/// (an order line id), read it unlocked, take the plant lock, then re-read and check it
/// did not move.
///
/// Before 2026-11-16 the paths disagreed (pickup scan and undo Inventories -> OrderLines,
/// manual fulfil and register adjust/void OrderLines -> Inventories, session scan
/// ScanSessions -> OrderLines -> Inventories, register scan and this class
/// PlantCatalogs -> Inventories -> OrderLines), and every pairing deadlocked under
/// <c>LockOrderRaceTests</c>. Retries hid it as latency; the manual, undo and stock
/// adjustment paths have no retry, so a deadlock there reached the volunteer.
///
/// Non-relational providers (the InMemory provider used by the unit tests) support
/// neither transactions nor FOR UPDATE, so these helpers degrade to no-ops there.
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
    /// for that plant (steps 2a-2c). Safe to call when no transaction is open (no-op on
    /// InMemory).
    /// </summary>
    public static async Task AcquireAsync(AppDbContext db, Guid plantCatalogId, Guid orderId)
    {
        if (!db.Database.IsRelational()) return;

        await LockPlantAsync(db, plantCatalogId);

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"OrderLines\" WHERE \"OrderId\" = {0} AND \"PlantCatalogId\" = {1} AND \"DeletedAt\" IS NULL FOR UPDATE",
            orderId, plantCatalogId);
    }

    /// <summary>
    /// <see cref="AcquireAsync(AppDbContext, Guid, Guid)"/> for several plants of one
    /// order, in ascending plant id (step 2's ordering). Duplicates are locked once.
    /// </summary>
    public static async Task AcquireAsync(AppDbContext db, IEnumerable<Guid> plantCatalogIds, Guid orderId)
    {
        foreach (var plantCatalogId in plantCatalogIds.Distinct().OrderBy(id => id))
            await AcquireAsync(db, plantCatalogId, orderId);
    }

    /// <summary>
    /// Locks the plant row and then its inventory row (steps 2a-2b). Every path that
    /// touches a plant's stock or lines starts here.
    /// </summary>
    public static async Task LockPlantAsync(AppDbContext db, Guid plantCatalogId)
    {
        if (!db.Database.IsRelational()) return;

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"PlantCatalogs\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
            plantCatalogId);

        await db.Database.ExecuteSqlRawAsync(
            "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
            plantCatalogId);
    }

    /// <summary>
    /// Locks order lines by id, in ascending id (step 2c). Call only while holding the
    /// lock on the lines' plant.
    /// </summary>
    public static async Task LockOrderLinesAsync(AppDbContext db, IEnumerable<Guid> orderLineIds)
    {
        if (!db.Database.IsRelational()) return;

        foreach (var lineId in orderLineIds.Distinct().OrderBy(id => id))
        {
            await db.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM \"OrderLines\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                lineId);
        }
    }

    /// <summary>Locks order rows in ascending id (step 3).</summary>
    public static async Task LockOrdersAsync(AppDbContext db, IEnumerable<Guid> orderIds)
    {
        if (!db.Database.IsRelational()) return;

        foreach (var orderId in orderIds.Distinct().OrderBy(id => id))
        {
            await db.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM \"Orders\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                orderId);
        }
    }

    /// <summary>
    /// Rolls back without letting a rollback failure mask the original error. Once
    /// Postgres aborts a transaction the rollback itself can throw, and that
    /// secondary exception carries none of the cause -- losing it turns a
    /// retryable serialization conflict into an opaque failure.
    ///
    /// A transaction that is already complete is left alone. Refusal branches roll
    /// back before throwing their ValidationException, and the catch-all then calls
    /// this again; rolling back a completed Npgsql transaction throws, and EF logs
    /// that at Error ("An error occurred using a transaction") before the catch
    /// below can swallow it -- one spurious Error per refused scan. A rollback that
    /// genuinely fails is still attempted, and still logged by EF.
    /// </summary>
    public static async Task RollbackQuietlyAsync(IDbContextTransaction? transaction)
    {
        if (transaction == null || IsCompleted(transaction)) return;

        try
        {
            await transaction.RollbackAsync();
        }
        catch
        {
            // The transaction is already dead; the original exception is what matters.
        }
    }

    /// <summary>
    /// True once the transaction has been committed or rolled back. ADO.NET providers
    /// (Npgsql and Microsoft.Data.Sqlite alike) clear <c>DbTransaction.Connection</c>
    /// when the transaction completes; a disposed one is complete too.
    /// </summary>
    private static bool IsCompleted(IDbContextTransaction transaction)
    {
        try
        {
            return transaction.GetDbTransaction().Connection == null;
        }
        catch (ObjectDisposedException)
        {
            return true;
        }
    }

    /// <summary>
    /// Runs a walk-up write, retrying when Postgres aborts the transaction with a
    /// serialization failure or deadlock. Under serializable isolation these are
    /// expected whenever two registers touch the same plant, and they are safe to
    /// retry because the aborted transaction committed nothing. Without this the
    /// volunteer sees "a transient failure has been raised" and has no idea whether
    /// the sale went through.
    /// </summary>
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
    }
}
