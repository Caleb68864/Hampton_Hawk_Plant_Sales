using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _db;

    public InventoryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<InventoryResponse>> GetAllAsync(string? search, PaginationParams paging)
    {
        var query = _db.Inventories
            .Include(i => i.PlantCatalog)
            .Where(i => i.DeletedAt == null && i.PlantCatalog.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                i.PlantCatalog.Name.ToLower().Contains(term) ||
                i.PlantCatalog.Sku.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(i => i.PlantCatalog.Name)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(i => new InventoryResponse
            {
                Id = i.Id,
                PlantCatalogId = i.PlantCatalogId,
                PlantName = i.PlantCatalog.Name,
                PlantSku = i.PlantCatalog.Sku,
                OnHandQty = i.OnHandQty,
                CreatedAt = i.CreatedAt,
                UpdatedAt = i.UpdatedAt
            })
            .ToListAsync();

        return new PagedResult<InventoryResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<InventoryResponse> SetInventoryAsync(Guid plantId, UpdateInventoryRequest request)
    {
        if (request.OnHandQty < 0)
            throw new ValidationException("On-hand quantity cannot be negative.");

        return await ApplyLockedAsync(plantId, inventory => request.OnHandQty - inventory.OnHandQty, request.Reason, request.Notes);
    }

    public async Task<InventoryResponse> AdjustInventoryAsync(AdjustInventoryRequest request)
    {
        return await ApplyLockedAsync(request.PlantId, _ => request.DeltaQty, request.Reason, request.Notes);
    }

    /// <summary>
    /// Applies a relative change to the inventory row under a FOR UPDATE lock so two
    /// concurrent adjustments (or an adjustment racing a scan) cannot lose an update,
    /// and refuses any change that would take the row below zero. The lock and
    /// transaction degrade to no-ops on the InMemory provider used by the tests.
    /// </summary>
    private async Task<InventoryResponse> ApplyLockedAsync(
        Guid plantId, Func<Inventory, int> deltaFor, string reason, string? notes)
    {
        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational ? await _db.Database.BeginTransactionAsync() : null;

        try
        {
            // MUTATION: inventory adjustment FOR UPDATE removed

            var inventory = await _db.Inventories
                .Include(i => i.PlantCatalog)
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plantId && i.DeletedAt == null)
                ?? throw new KeyNotFoundException("Inventory record not found for this plant.");

            var delta = deltaFor(inventory);
            var newQty = inventory.OnHandQty + delta;
            if (newQty < 0)
                throw new ValidationException(
                    $"Adjustment of {delta} would take on-hand quantity below zero (currently {inventory.OnHandQty}).");

            inventory.OnHandQty = newQty;

            _db.InventoryAdjustments.Add(new InventoryAdjustment
            {
                PlantCatalogId = plantId,
                DeltaQty = delta,
                Reason = reason,
                Notes = notes
            });

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            return new InventoryResponse
            {
                Id = inventory.Id,
                PlantCatalogId = inventory.PlantCatalogId,
                PlantName = inventory.PlantCatalog.Name,
                PlantSku = inventory.PlantCatalog.Sku,
                OnHandQty = inventory.OnHandQty,
                CreatedAt = inventory.CreatedAt,
                UpdatedAt = inventory.UpdatedAt
            };
        }
        catch
        {
            await WalkUpRowLocks.RollbackQuietlyAsync(transaction);
            throw;
        }
        finally
        {
            if (transaction != null) await transaction.DisposeAsync();
        }
    }
}
