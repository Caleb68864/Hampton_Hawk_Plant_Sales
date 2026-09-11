using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

/// <summary>
/// Walk-up availability is on-hand stock minus everything already promised.
///
/// "Promised" means any unfulfilled order line, preorder or walk-up alike. Counting
/// only preorders left walk-up demand invisible to its own availability check: a
/// walk-up line does not decrement OnHandQty (that happens at fulfillment), so the
/// same unit could be committed to buyer after buyer without the number ever moving.
///
/// Fulfilled quantities are deliberately excluded, because handing stock over already
/// decremented OnHandQty -- subtracting them again would double-count. That is what
/// makes one formula serve both flows: the register decrements at scan time and
/// records QtyOrdered == QtyFulfilled, so its sales contribute nothing here.
/// </summary>
public class InventoryProtectionService : IInventoryProtectionService
{
    private readonly AppDbContext _db;

    public InventoryProtectionService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<int> GetAvailableForWalkupAsync(Guid plantCatalogId)
    {
        var onHand = await _db.Inventories
            .Where(i => i.PlantCatalogId == plantCatalogId)
            .Select(i => i.OnHandQty)
            .FirstOrDefaultAsync();

        var committed = await GetOutstandingCommitmentsAsync(plantCatalogId);

        return Math.Max(0, onHand - committed);
    }

    public async Task<List<WalkUpAvailabilityResponse>> GetAllAvailabilityAsync()
    {
        var plants = await _db.PlantCatalogs
            .Where(p => p.IsActive && p.DeletedAt == null)
            .ToListAsync();

        var plantIds = plants.Select(p => p.Id).ToList();

        // Get all on-hand quantities in one query
        var inventories = await _db.Inventories
            .Where(i => plantIds.Contains(i.PlantCatalogId))
            .ToDictionaryAsync(i => i.PlantCatalogId, i => i.OnHandQty);

        // Outstanding commitments for all plants in one query. Must stay in step with
        // GetOutstandingCommitmentsAsync -- a divergence here would make the list view
        // disagree with the check that actually blocks a sale.
        var committedTotals = await _db.OrderLines
            .Where(ol => plantIds.Contains(ol.PlantCatalogId)
                && ol.DeletedAt == null
                && ol.Order.Status != OrderStatus.Cancelled
                && ol.Order.Status != OrderStatus.Complete
                && ol.Order.DeletedAt == null)
            .GroupBy(ol => ol.PlantCatalogId)
            .Select(g => new { PlantCatalogId = g.Key, Remaining = g.Sum(ol => ol.QtyOrdered - ol.QtyFulfilled) })
            .ToDictionaryAsync(x => x.PlantCatalogId, x => Math.Max(0, x.Remaining));

        return plants.Select(p =>
        {
            var onHand = inventories.TryGetValue(p.Id, out var qty) ? qty : 0;
            var committed = committedTotals.TryGetValue(p.Id, out var rem) ? rem : 0;
            var available = Math.Max(0, onHand - committed);

            return new WalkUpAvailabilityResponse
            {
                PlantCatalogId = p.Id,
                PlantName = p.Name,
                PlantSku = p.Sku,
                OnHandQty = onHand,
                OutstandingCommitments = committed,
                AvailableForWalkup = available
            };
        }).ToList();
    }

    public async Task<(bool Allowed, int Available, string? ErrorMessage)> ValidateWalkupLineAsync(
        Guid plantCatalogId, int requestedQty, Guid? excludeOrderId = null)
    {
        var onHand = await _db.Inventories
            .Where(i => i.PlantCatalogId == plantCatalogId)
            .Select(i => i.OnHandQty)
            .FirstOrDefaultAsync();

        var committed = await GetOutstandingCommitmentsAsync(plantCatalogId, excludeOrderId);

        var available = Math.Max(0, onHand - committed);

        if (requestedQty > available)
        {
            var plantName = await _db.PlantCatalogs
                .Where(p => p.Id == plantCatalogId)
                .Select(p => p.Name)
                .FirstOrDefaultAsync() ?? "Unknown plant";

            return (false, available,
                $"Only {available} units of '{plantName}' available for walk-up orders (on-hand: {onHand}, already committed: {committed}). Requested: {requestedQty}.");
        }

        return (true, available, null);
    }

    /// <summary>
    /// Units promised but not yet handed over, across preorder and walk-up orders
    /// alike. <paramref name="excludeOrderId"/> omits an order's own lines so editing
    /// a line is not blocked by the quantity it already holds.
    ///
    /// Cancelled and Complete orders are both excluded: a force-completed order may
    /// carry an unfulfilled remainder, but nobody is coming back for it, and leaving
    /// it in the sum would permanently shrink walk-up availability for stock that is
    /// still sitting on the table.
    /// </summary>
    private async Task<int> GetOutstandingCommitmentsAsync(Guid plantCatalogId, Guid? excludeOrderId = null)
    {
        var query = _db.OrderLines
            .Where(ol => ol.PlantCatalogId == plantCatalogId
                && ol.DeletedAt == null
                && ol.Order.Status != OrderStatus.Cancelled
                && ol.Order.Status != OrderStatus.Complete
                && ol.Order.DeletedAt == null);

        if (excludeOrderId.HasValue)
            query = query.Where(ol => ol.OrderId != excludeOrderId.Value);

        var remaining = await query
            .SumAsync(ol => ol.QtyOrdered - ol.QtyFulfilled);

        return Math.Max(0, remaining);
    }
}
