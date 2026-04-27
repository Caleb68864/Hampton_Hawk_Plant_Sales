using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateOrderRequest
{
    public Guid CustomerId { get; set; }
    public Guid? SellerId { get; set; }
    public string? OrderNumber { get; set; }
    public bool IsWalkUp { get; set; }
    public List<CreateOrderLineRequest>? Lines { get; set; }
}

public class UpdateOrderRequest
{
    public Guid CustomerId { get; set; }
    public Guid? SellerId { get; set; }
    public OrderStatus Status { get; set; }
    public bool IsWalkUp { get; set; }
    public bool HasIssue { get; set; }
}

public class CreateOrderLineRequest
{
    public Guid PlantCatalogId { get; set; }
    public int QtyOrdered { get; set; }
    public string? Notes { get; set; }
}

public class UpdateOrderLineRequest
{
    public int? QtyOrdered { get; set; }
    public Guid? PlantCatalogId { get; set; }
    public string? Notes { get; set; }
}

public class OrderResponse
{
    public Guid Id { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? SellerId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public OrderStatus Status { get; set; }
    public bool IsWalkUp { get; set; }
    public bool HasIssue { get; set; }
    public string? PaymentMethod { get; set; }
    public decimal? AmountTendered { get; set; }
    public CustomerResponse? Customer { get; set; }
    public SellerResponse? Seller { get; set; }
    public List<OrderLineResponse> Lines { get; set; } = new();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}

public class OrderLineResponse
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string PlantSku { get; set; } = string.Empty;
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public string? Notes { get; set; }
    public string? LastScanIdempotencyKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

// ===== Bulk Operation DTOs =====

/// <summary>
/// Request to bulk complete multiple orders at once.
/// </summary>
public class BulkCompleteOrdersRequest
{
    public List<Guid> OrderIds { get; set; } = new();
}

/// <summary>
/// Request to bulk set status on multiple orders at once.
/// </summary>
public class BulkSetOrderStatusRequest
{
    public List<Guid> OrderIds { get; set; } = new();
    public OrderStatus TargetStatus { get; set; }
}

/// <summary>
/// Result of a bulk operation containing per-order outcomes.
/// </summary>
public class BulkOperationResult
{
    public List<BulkOrderOutcome> Outcomes { get; set; } = new();
}

/// <summary>
/// Outcome for a single order in a bulk operation.
/// </summary>
public class BulkOrderOutcome
{
    public Guid OrderId { get; set; }
    public string Outcome { get; set; } = string.Empty; // Completed, Skipped, StatusChanged
    public string? Reason { get; set; }
}
