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
    public int QtyOrdered { get; set; }
    public Guid? PlantCatalogId { get; set; }
    public string? Notes { get; set; }
}

public class OrderResponse
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Guid? SellerId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public bool IsWalkUp { get; set; }
    public bool HasIssue { get; set; }
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
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
