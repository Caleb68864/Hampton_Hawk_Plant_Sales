using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class SellerService : ISellerService
{
    private readonly AppDbContext _db;

    public SellerService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<SellerResponse>> GetAllAsync(string? search, bool includeDeleted, PaginationParams paging)
    {
        var query = includeDeleted
            ? _db.Sellers.IgnoreQueryFilters().AsQueryable()
            : _db.Sellers.AsQueryable();

        if (!includeDeleted)
            query = query.Where(s => s.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim();
            if (trimmed.EndsWith("*") && trimmed.Length == 2)
            {
                // A-Z letter filter: e.g. "S*" -> filter by seller display name initial
                var initial = trimmed[..1].ToLower();
                query = query.Where(s => s.DisplayName.ToLower().StartsWith(initial));
            }
            else
            {
                var term = trimmed.ToLower();
                query = query.Where(s =>
                    s.DisplayName.ToLower().Contains(term) ||
                    (s.LastName != null && s.LastName.ToLower().Contains(term)));
            }
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(s => s.DisplayName)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(s => MapToResponse(s))
            .ToListAsync();

        return new PagedResult<SellerResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<SellerResponse?> GetByIdAsync(Guid id)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == id && s.DeletedAt == null);
        return seller == null ? null : MapToResponse(seller);
    }

    public async Task<SellerResponse> CreateAsync(CreateSellerRequest request)
    {
        var seller = new Seller
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            DisplayName = request.DisplayName,
            Grade = request.Grade,
            Teacher = request.Teacher,
            Notes = request.Notes
        };

        _db.Sellers.Add(seller);
        await _db.SaveChangesAsync();

        return MapToResponse(seller);
    }

    public async Task<SellerResponse> UpdateAsync(Guid id, UpdateSellerRequest request)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == id && s.DeletedAt == null)
            ?? throw new KeyNotFoundException("Seller not found.");

        seller.FirstName = request.FirstName;
        seller.LastName = request.LastName;
        seller.DisplayName = request.DisplayName;
        seller.Grade = request.Grade;
        seller.Teacher = request.Teacher;
        seller.Notes = request.Notes;

        await _db.SaveChangesAsync();

        return MapToResponse(seller);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == id && s.DeletedAt == null);
        if (seller == null) return false;

        seller.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    private static SellerResponse MapToResponse(Seller s) => new()
    {
        Id = s.Id,
        FirstName = s.FirstName,
        LastName = s.LastName,
        DisplayName = s.DisplayName,
        Grade = s.Grade,
        Teacher = s.Teacher,
        Notes = s.Notes,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt,
        DeletedAt = s.DeletedAt
    };
}
