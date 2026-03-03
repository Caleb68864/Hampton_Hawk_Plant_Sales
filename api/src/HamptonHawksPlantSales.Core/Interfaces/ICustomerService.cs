using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface ICustomerService
{
    Task<PagedResult<CustomerResponse>> GetAllAsync(string? search, bool includeDeleted, PaginationParams paging);
    Task<CustomerResponse?> GetByIdAsync(Guid id);
    Task<CustomerResponse> CreateAsync(CreateCustomerRequest request);
    Task<CustomerResponse> UpdateAsync(Guid id, UpdateCustomerRequest request);
    Task<bool> DeleteAsync(Guid id);
}
