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
        var inventory = await _db.Inventories
            .Include(i => i.PlantCatalog)
            .FirstOrDefaultAsync(i => i.PlantCatalogId == plantId && i.DeletedAt == null)
            ?? throw new KeyNotFoundException("Inventory record not found for this plant.");

        var delta = request.OnHandQty - inventory.OnHandQty;

        inventory.OnHandQty = request.OnHandQty;

        _db.InventoryAdjustments.Add(new InventoryAdjustment
        {
            PlantCatalogId = plantId,
            DeltaQty = delta,
            Reason = request.Reason,
            Notes = request.Notes
        });

        await _db.SaveChangesAsync();

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

    public async Task<InventoryResponse> AdjustInventoryAsync(AdjustInventoryRequest request)
    {
        var inventory = await _db.Inventories
            .Include(i => i.PlantCatalog)
            .FirstOrDefaultAsync(i => i.PlantCatalogId == request.PlantId && i.DeletedAt == null)
            ?? throw new KeyNotFoundException("Inventory record not found for this plant.");

        inventory.OnHandQty += request.DeltaQty;

        _db.InventoryAdjustments.Add(new InventoryAdjustment
        {
            PlantCatalogId = request.PlantId,
            DeltaQty = request.DeltaQty,
            Reason = request.Reason,
            Notes = request.Notes
        });

        await _db.SaveChangesAsync();

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
}
