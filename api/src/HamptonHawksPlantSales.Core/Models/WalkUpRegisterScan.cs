namespace HamptonHawksPlantSales.Core.Models;

/// <summary>
/// One applied walk-up register scan. A retried request whose scan id is already
/// recorded on this draft is a replay and must not take stock again -- including a
/// delayed retry of an older scan arriving after newer ones, which a single
/// last-scan-id column on the line cannot recognise. Rows are never deleted: a scan
/// whose line was later voided is still a replay.
/// </summary>
public class WalkUpRegisterScan : EventEntity
{
    public Guid OrderId { get; set; }
    public string ScanId { get; set; } = string.Empty;
    public Guid PlantCatalogId { get; set; }

    /// <summary>Units the scan actually added (after the on-hand cap).</summary>
    public int Quantity { get; set; }

    public Order Order { get; set; } = null!;
    public PlantCatalog PlantCatalog { get; set; } = null!;
}
