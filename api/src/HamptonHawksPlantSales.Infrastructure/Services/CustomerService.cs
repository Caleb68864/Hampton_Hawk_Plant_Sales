using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class CustomerService : ICustomerService
{
    private readonly AppDbContext _db;

    public CustomerService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<CustomerResponse>> GetAllAsync(string? search, bool includeDeleted, PaginationParams paging)
    {
        var query = includeDeleted
            ? _db.Customers.IgnoreQueryFilters().AsQueryable()
            : _db.Customers.AsQueryable();

        if (!includeDeleted)
            query = query.Where(c => c.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim();
            if (trimmed.EndsWith("*") && trimmed.Length == 2)
            {
                // A-Z letter filter: e.g. "A*" -> filter by display name initial
                var initial = trimmed[..1].ToLower();
                query = query.Where(c => c.DisplayName.ToLower().StartsWith(initial));
            }
            else
            {
                var term = trimmed.ToLower();
                query = query.Where(c =>
                    c.DisplayName.ToLower().Contains(term) ||
                    (c.LastName != null && c.LastName.ToLower().Contains(term)) ||
                    (c.Phone != null && c.Phone.Contains(term)) ||
                    c.PickupCode.ToLower().Contains(term));
            }
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(c => c.DisplayName)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(c => MapToResponse(c))
            .ToListAsync();

        return new PagedResult<CustomerResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<CustomerResponse?> GetByIdAsync(Guid id)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null);
        return customer == null ? null : MapToResponse(customer);
    }

    public async Task<CustomerResponse> CreateAsync(CreateCustomerRequest request)
    {
        var customer = new Customer
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            DisplayName = request.DisplayName,
            Phone = request.Phone,
            Email = request.Email,
            PickupCode = string.IsNullOrWhiteSpace(request.PickupCode)
                ? GeneratePickupCode()
                : request.PickupCode,
            Notes = request.Notes
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();

        return MapToResponse(customer);
    }

    public async Task<CustomerResponse> UpdateAsync(Guid id, UpdateCustomerRequest request)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null)
            ?? throw new KeyNotFoundException("Customer not found.");

        customer.FirstName = request.FirstName;
        customer.LastName = request.LastName;
        customer.DisplayName = request.DisplayName;
        customer.Phone = request.Phone;
        customer.Email = request.Email;
        if (!string.IsNullOrWhiteSpace(request.PickupCode))
            customer.PickupCode = request.PickupCode;
        customer.Notes = request.Notes;

        await _db.SaveChangesAsync();

        return MapToResponse(customer);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.DeletedAt == null);
        if (customer == null) return false;

        customer.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    private static string GeneratePickupCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private static CustomerResponse MapToResponse(Customer c) => new()
    {
        Id = c.Id,
        FirstName = c.FirstName,
        LastName = c.LastName,
        DisplayName = c.DisplayName,
        Phone = c.Phone,
        Email = c.Email,
        PickupCode = c.PickupCode,
        PicklistBarcode = c.PicklistBarcode,
        Notes = c.Notes,
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
        DeletedAt = c.DeletedAt
    };
}
