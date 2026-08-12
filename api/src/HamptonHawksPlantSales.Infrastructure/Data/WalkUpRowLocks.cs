using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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
}
