using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

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

        var preorderRemaining = await GetPreorderRemainingAsync(plantCatalogId);

        return Math.Max(0, onHand - preorderRemaining);
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

        // Get preorder remaining for all plants in one query
        var preorderTotals = await _db.OrderLines
            .Where(ol => plantIds.Contains(ol.PlantCatalogId)
                && ol.DeletedAt == null
                && ol.Order.IsWalkUp == false
                && ol.Order.Status != OrderStatus.Cancelled
                && ol.Order.DeletedAt == null)
            .GroupBy(ol => ol.PlantCatalogId)
            .Select(g => new { PlantCatalogId = g.Key, Remaining = g.Sum(ol => ol.QtyOrdered - ol.QtyFulfilled) })
            .ToDictionaryAsync(x => x.PlantCatalogId, x => Math.Max(0, x.Remaining));

        return plants.Select(p =>
        {
            var onHand = inventories.TryGetValue(p.Id, out var qty) ? qty : 0;
            var preorderRemaining = preorderTotals.TryGetValue(p.Id, out var rem) ? rem : 0;
            var available = Math.Max(0, onHand - preorderRemaining);

            return new WalkUpAvailabilityResponse
            {
                PlantCatalogId = p.Id,
                PlantName = p.Name,
                PlantSku = p.Sku,
                OnHandQty = onHand,
                PreorderRemaining = preorderRemaining,
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

        var preorderRemaining = await GetPreorderRemainingAsync(plantCatalogId, excludeOrderId);

        var available = Math.Max(0, onHand - preorderRemaining);

        if (requestedQty > available)
        {
            var plantName = await _db.PlantCatalogs
                .Where(p => p.Id == plantCatalogId)
                .Select(p => p.Name)
                .FirstOrDefaultAsync() ?? "Unknown plant";

            return (false, available,
                $"Only {available} units of '{plantName}' available for walk-up orders (on-hand: {onHand}, preorder remaining: {preorderRemaining}). Requested: {requestedQty}.");
        }

        return (true, available, null);
    }

    private async Task<int> GetPreorderRemainingAsync(Guid plantCatalogId, Guid? excludeOrderId = null)
    {
        var query = _db.OrderLines
            .Where(ol => ol.PlantCatalogId == plantCatalogId
                && ol.DeletedAt == null
                && ol.Order.IsWalkUp == false
                && ol.Order.Status != OrderStatus.Cancelled
                && ol.Order.DeletedAt == null);

        if (excludeOrderId.HasValue)
            query = query.Where(ol => ol.OrderId != excludeOrderId.Value);

        var remaining = await query
            .SumAsync(ol => ol.QtyOrdered - ol.QtyFulfilled);

        return Math.Max(0, remaining);
    }
}
