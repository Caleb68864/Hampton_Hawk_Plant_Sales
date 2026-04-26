using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IOrderService
{
    Task<PagedResult<OrderResponse>> GetAllAsync(string? search, OrderStatus? status, bool? isWalkUp, Guid? sellerId, Guid? customerId, bool includeDeleted, PaginationParams paging, bool includeDraft = false);
    Task<OrderResponse?> GetByIdAsync(Guid id);
    Task<OrderResponse> CreateAsync(CreateOrderRequest request);
    Task<OrderResponse> UpdateAsync(Guid id, UpdateOrderRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<int> DeleteAllOrdersAsync();
    Task<int> RegenerateAllBarcodesAsync();
    Task<OrderLineResponse> AddLineAsync(Guid orderId, CreateOrderLineRequest request, string? adminPin = null, string? adminReason = null);
    Task<OrderLineResponse> UpdateLineAsync(Guid orderId, Guid lineId, UpdateOrderLineRequest request);
    Task<bool> DeleteLineAsync(Guid orderId, Guid lineId);
    Task<BulkOperationResult> BulkCompleteAsync(BulkCompleteOrdersRequest request, string? adminReason = null);
    Task<BulkOperationResult> BulkSetStatusAsync(BulkSetOrderStatusRequest request, string? adminReason = null);
}
