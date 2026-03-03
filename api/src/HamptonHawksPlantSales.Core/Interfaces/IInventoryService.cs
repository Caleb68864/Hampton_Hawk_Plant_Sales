using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IInventoryService
{
    Task<PagedResult<InventoryResponse>> GetAllAsync(string? search, PaginationParams paging);
    Task<InventoryResponse> SetInventoryAsync(Guid plantId, UpdateInventoryRequest request);
    Task<InventoryResponse> AdjustInventoryAsync(AdjustInventoryRequest request);
}
