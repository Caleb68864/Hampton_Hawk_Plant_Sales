using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IInventoryProtectionService
{
    Task<int> GetAvailableForWalkupAsync(Guid plantCatalogId);
    Task<List<WalkUpAvailabilityResponse>> GetAllAvailabilityAsync();
    Task<(bool Allowed, int Available, string? ErrorMessage)> ValidateWalkupLineAsync(Guid plantCatalogId, int requestedQty, Guid? excludeOrderId = null);
}
