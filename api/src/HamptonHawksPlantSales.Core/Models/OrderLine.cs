namespace HamptonHawksPlantSales.Core.Models;

public class OrderLine : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid PlantCatalogId { get; set; }
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public string? Notes { get; set; }
    public string? LastScanIdempotencyKey { get; set; }

    public Order Order { get; set; } = null!;
    public PlantCatalog PlantCatalog { get; set; } = null!;
}
