namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Outstanding-order aging buckets for orders in Open or
// InProgress status. Buckets: "<24h", "1-3d", "3-7d", ">7d" computed from
// (UtcNow - CreatedAt).TotalHours. Excludes soft-deleted and Draft orders.
// All four buckets are always returned (even with zero counts) so the UI can
// render a stable layout.

public class OutstandingAgingResponse
{
    public List<OutstandingAgingBucketDto> Buckets { get; set; } = new();
}

public class OutstandingAgingBucketDto
{
    public string Bucket { get; set; } = string.Empty;
    public int Count { get; set; }
    public double OldestAgeHours { get; set; }
}
