using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class PlantService : IPlantService
{
    private readonly AppDbContext _db;

    public PlantService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<PlantResponse>> GetAllAsync(string? search, bool? activeOnly, bool includeDeleted, PaginationParams paging)
    {
        var query = includeDeleted
            ? _db.PlantCatalogs.IgnoreQueryFilters().AsQueryable()
            : _db.PlantCatalogs.AsQueryable();

        if (!includeDeleted)
            query = query.Where(p => p.DeletedAt == null);

        if (activeOnly == true)
            query = query.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim();
            if (trimmed.EndsWith("*") && trimmed.Length == 2)
            {
                var initial = trimmed[..1].ToLower();
                query = query.Where(p => p.Name.ToLower().StartsWith(initial));
            }
            else
            {
                var term = trimmed.ToLower();
                query = query.Where(p =>
                    p.Name.ToLower().Contains(term) ||
                    p.Sku.ToLower().Contains(term) ||
                    p.Barcode.ToLower().Contains(term));
            }
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(p => p.Name)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(p => MapToResponse(p))
            .ToListAsync();

        return new PagedResult<PlantResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<PlantResponse?> GetByIdAsync(Guid id)
    {
        var plant = await _db.PlantCatalogs.FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null);
        return plant == null ? null : MapToResponse(plant);
    }

    public async Task<PlantResponse> CreateAsync(CreatePlantRequest request)
    {
        var existingSku = await _db.PlantCatalogs.AnyAsync(p => p.Sku == request.Sku && p.DeletedAt == null);
        if (existingSku)
            throw new ValidationException("A plant with this SKU already exists.");

        var existingBarcode = await _db.PlantCatalogs.AnyAsync(p => p.Barcode == request.Barcode && p.DeletedAt == null);
        if (existingBarcode)
            throw new ValidationException("A plant with this Barcode already exists.");

        var plant = new PlantCatalog
        {
            Sku = request.Sku,
            Name = request.Name,
            Variant = request.Variant,
            Price = request.Price,
            Barcode = request.Barcode,
            IsActive = request.IsActive
        };

        _db.PlantCatalogs.Add(plant);
        _db.Inventories.Add(new Inventory
        {
            PlantCatalogId = plant.Id,
            OnHandQty = 0
        });
        await _db.SaveChangesAsync();

        return MapToResponse(plant);
    }

    public async Task<PlantResponse> UpdateAsync(Guid id, UpdatePlantRequest request, bool allowLockedBarcodeChange = false)
    {
        var plant = await _db.PlantCatalogs.FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null)
            ?? throw new KeyNotFoundException("Plant not found.");

        // BarcodeLockedAt is set by the first scan: its labels are printed and on
        // plants. Changing the barcode then makes every one of them unscannable, so
        // it needs the admin PIN (PUT /api/plants/{id}/locked-barcode).
        if (plant.BarcodeLockedAt != null && !allowLockedBarcodeChange
            && !string.Equals(plant.Barcode, request.Barcode?.Trim(), StringComparison.Ordinal))
        {
            throw new ValidationException(
                "This plant has already been scanned, so its printed labels are in use. Changing its barcode needs the admin PIN.");
        }

        var existingSku = await _db.PlantCatalogs.AnyAsync(p => p.Sku == request.Sku && p.Id != id && p.DeletedAt == null);
        if (existingSku)
            throw new ValidationException("A plant with this SKU already exists.");

        var existingBarcode = await _db.PlantCatalogs.AnyAsync(p => p.Barcode == request.Barcode && p.Id != id && p.DeletedAt == null);
        if (existingBarcode)
            throw new ValidationException("A plant with this Barcode already exists.");

        plant.Sku = request.Sku;
        plant.Name = request.Name;
        plant.Variant = request.Variant;
        plant.Price = request.Price;
        plant.Barcode = request.Barcode;
        plant.IsActive = request.IsActive;

        await _db.SaveChangesAsync();

        return MapToResponse(plant);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var plant = await _db.PlantCatalogs.FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null);
        if (plant == null) return false;

        plant.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    private static PlantResponse MapToResponse(PlantCatalog p) => new()
    {
        Id = p.Id,
        Sku = p.Sku,
        Name = p.Name,
        Variant = p.Variant,
        Price = p.Price,
        Barcode = p.Barcode,
        IsActive = p.IsActive,
        BarcodeLockedAt = p.BarcodeLockedAt,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        DeletedAt = p.DeletedAt
    };
}
