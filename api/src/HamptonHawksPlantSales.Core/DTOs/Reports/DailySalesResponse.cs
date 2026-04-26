namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Daily sales aggregation. Groups orders by CreatedAt.Date and
// reports per-day order count, total item count, revenue (sum of AmountTendered),
// plus walk-up vs preorder split. Excludes soft-deleted and Draft orders.

public class DailySalesResponse
{
    public List<DailySalesDayDto> Days { get; set; } = new();
}

public class DailySalesDayDto
{
    public DateOnly Date { get; set; }
    public int OrderCount { get; set; }
    public int ItemCount { get; set; }
    public decimal Revenue { get; set; }
    public int WalkUpCount { get; set; }
    public int PreorderCount { get; set; }
}
