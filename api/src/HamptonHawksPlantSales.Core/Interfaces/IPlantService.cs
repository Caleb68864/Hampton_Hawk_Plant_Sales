using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IPlantService
{
    Task<PagedResult<PlantResponse>> GetAllAsync(string? search, bool? activeOnly, bool includeDeleted, PaginationParams paging);
    Task<PlantResponse?> GetByIdAsync(Guid id);
    Task<PlantResponse> CreateAsync(CreatePlantRequest request);
    /// <param name="allowLockedBarcodeChange">True only from the admin-PIN route: a plant
    /// that has been scanned keeps its barcode otherwise.</param>
    Task<PlantResponse> UpdateAsync(Guid id, UpdatePlantRequest request, bool allowLockedBarcodeChange = false);
    Task<bool> DeleteAsync(Guid id);
}
