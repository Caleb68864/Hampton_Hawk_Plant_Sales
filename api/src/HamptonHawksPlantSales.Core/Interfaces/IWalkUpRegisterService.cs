using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IWalkUpRegisterService
{
    Task<OrderResponse> CreateDraftAsync(CreateDraftRequest request);

    Task<OrderResponse> ScanIntoDraftAsync(Guid orderId, ScanIntoDraftRequest request);

    Task<OrderResponse> AdjustLineAsync(
        Guid orderId,
        Guid lineId,
        AdjustLineRequest request,
        string? adminPin = null,
        string? adminReason = null);

    Task<OrderResponse> VoidLineAsync(
        Guid orderId,
        Guid lineId,
        string adminReason);

    Task<OrderResponse> CloseDraftAsync(
        Guid orderId,
        CloseDraftRequest request);

    Task<OrderResponse> CancelDraftAsync(
        Guid orderId,
        string adminReason);

    Task<List<OrderResponse>> GetOpenDraftsAsync(string? workstationName = null);
}
