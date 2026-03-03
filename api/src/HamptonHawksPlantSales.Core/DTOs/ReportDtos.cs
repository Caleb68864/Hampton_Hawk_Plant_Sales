using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public class DashboardMetricsResponse
{
    public int TotalOrders { get; set; }
    public int OpenOrders { get; set; }
    public int CompletedOrders { get; set; }
    public int TotalCustomers { get; set; }
    public int TotalSellers { get; set; }
    public int LowInventoryCount { get; set; }
    public int ProblemOrderCount { get; set; }
    public Dictionary<string, int> OrdersByStatus { get; set; } = new();
    public int TotalItemsOrdered { get; set; }
    public int TotalItemsFulfilled { get; set; }
    public double SaleProgressPercent { get; set; }
}

public class LowInventoryResponse
{
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public int OnHandQty { get; set; }
}

public class ProblemOrderResponse
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? SellerName { get; set; }
    public OrderStatus Status { get; set; }
    public int LineCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class SellerOrderSummaryResponse
{
    public Guid OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public bool HasIssue { get; set; }
    public int TotalItemsOrdered { get; set; }
    public int TotalItemsFulfilled { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
