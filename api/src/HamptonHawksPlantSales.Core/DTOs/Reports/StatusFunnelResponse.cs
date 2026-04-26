using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Order status funnel. Counts orders per non-Draft OrderStatus
// and reports the percentage of total. Excludes soft-deleted and Draft orders;
// percentages are calculated on the non-Draft denominator so they sum to ~100%.

public class StatusFunnelResponse
{
    public List<StatusFunnelBucketDto> Buckets { get; set; } = new();
    public int Total { get; set; }
}

public class StatusFunnelBucketDto
{
    public OrderStatus Status { get; set; }
    public int Count { get; set; }
    public double Percent { get; set; }
}
