namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Top-moving plants. Groups order lines by PlantCatalogId
// (joined to PlantCatalog for display name), sorted by QtyOrdered desc, with
// configurable limit. Excludes soft-deleted lines/orders and Draft orders.

public class TopMoversResponse
{
    public List<TopMoverRowDto> Plants { get; set; } = new();
}

public class TopMoverRowDto
{
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public int OrderCount { get; set; }
}
