using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface ISellerService
{
    Task<PagedResult<SellerResponse>> GetAllAsync(string? search, bool includeDeleted, PaginationParams paging);
    Task<SellerResponse?> GetByIdAsync(Guid id);
    Task<SellerResponse> CreateAsync(CreateSellerRequest request);
    Task<SellerResponse> UpdateAsync(Guid id, UpdateSellerRequest request);
    Task<bool> DeleteAsync(Guid id);
}
