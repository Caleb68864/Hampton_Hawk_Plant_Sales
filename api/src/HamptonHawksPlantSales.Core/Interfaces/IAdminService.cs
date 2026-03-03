using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IAdminService
{
    Task<AdminAction> LogActionAsync(string actionType, string entityType, Guid entityId, string reason, string? message = null);
    Task<bool> IsSaleClosedAsync();
    Task<List<AdminActionResponse>> GetActionsAsync(Guid? orderId, string? entityType, string? actionType);
}
