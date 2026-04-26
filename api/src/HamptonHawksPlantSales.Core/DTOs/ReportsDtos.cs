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

// ── SS-04/SS-05: Sales aggregate reports ──

public class SalesBySellerRow
{
    public Guid SellerId { get; set; }
    public string SellerDisplayName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public int ItemsOrdered { get; set; }
    public int ItemsFulfilled { get; set; }
    public decimal RevenueOrdered { get; set; }
    public decimal RevenueFulfilled { get; set; }
}

public class SalesByCustomerRow
{
    public Guid CustomerId { get; set; }
    public string CustomerDisplayName { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public int ItemsOrdered { get; set; }
    public int ItemsFulfilled { get; set; }
    public decimal RevenueOrdered { get; set; }
    public decimal RevenueFulfilled { get; set; }
}

public class SalesByPlantRow
{
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string PlantSku { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public int ItemsOrdered { get; set; }
    public int ItemsFulfilled { get; set; }
    public decimal RevenueOrdered { get; set; }
    public decimal RevenueFulfilled { get; set; }
}
