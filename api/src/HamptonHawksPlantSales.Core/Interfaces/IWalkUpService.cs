using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IWalkUpService
{
    Task<OrderResponse> CreateWalkUpOrderAsync(CreateWalkUpOrderRequest request);
    Task<OrderLineResponse> AddWalkUpLineAsync(Guid orderId, AddWalkUpLineRequest request, string? adminPin = null, string? adminReason = null);
    Task<OrderLineResponse> UpdateWalkUpLineAsync(Guid orderId, Guid lineId, UpdateWalkUpLineRequest request, string? adminPin = null, string? adminReason = null);
}
