using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IPlantService
{
    Task<PagedResult<PlantResponse>> GetAllAsync(string? search, bool? activeOnly, bool includeDeleted, PaginationParams paging);
    Task<PlantResponse?> GetByIdAsync(Guid id);
    Task<PlantResponse> CreateAsync(CreatePlantRequest request);
    Task<PlantResponse> UpdateAsync(Guid id, UpdatePlantRequest request);
    Task<bool> DeleteAsync(Guid id);
}
