using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IFulfillmentService
{
    Task<ScanResponse> ScanAsync(Guid orderId, string barcode);
    Task<ScanResponse> UndoLastScanAsync(Guid orderId);
    Task<bool> CompleteOrderAsync(Guid orderId);
    Task<bool> ForceCompleteOrderAsync(Guid orderId, string reason);
    Task<bool> ResetOrderAsync(Guid orderId, string reason);
    Task<List<FulfillmentEventResponse>> GetEventsAsync(Guid orderId);
}
