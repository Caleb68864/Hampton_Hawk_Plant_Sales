using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IFulfillmentService
{
    Task<ScanResponse> ScanAsync(Guid orderId, string barcode, int quantity = 1);
    Task<ScanResponse> ManualFulfillAsync(Guid orderId, ManualFulfillRequest request);
    Task<ScanResponse> UndoLastScanAsync(Guid orderId, string reason, string operatorName);
    Task<bool> CompleteOrderAsync(Guid orderId);
    Task<bool> ForceCompleteOrderAsync(Guid orderId, string reason, string operatorName);
    Task<bool> ResetOrderAsync(Guid orderId, string reason, string operatorName);
    Task<List<FulfillmentEventResponse>> GetEventsAsync(Guid orderId);
}
