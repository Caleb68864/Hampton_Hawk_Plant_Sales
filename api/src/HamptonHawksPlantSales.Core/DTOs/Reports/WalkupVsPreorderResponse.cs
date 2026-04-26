namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Walk-up vs preorder channel split. Reports order count, item
// count, revenue, and average order for each channel, plus the walk-up share
// of total orders. Excludes soft-deleted and Draft orders.

public class WalkupVsPreorderResponse
{
    public ChannelMetricsDto WalkUp { get; set; } = new();
    public ChannelMetricsDto Preorder { get; set; } = new();
    public double WalkUpRatio { get; set; }
}

public class ChannelMetricsDto
{
    public int OrderCount { get; set; }
    public int ItemCount { get; set; }
    public decimal Revenue { get; set; }
    public decimal AverageOrder { get; set; }
}
