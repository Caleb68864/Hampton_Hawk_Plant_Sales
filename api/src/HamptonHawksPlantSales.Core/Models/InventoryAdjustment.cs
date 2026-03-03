namespace HamptonHawksPlantSales.Core.Models;

public class InventoryAdjustment : EventEntity
{
    public Guid PlantCatalogId { get; set; }
    public int DeltaQty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public PlantCatalog PlantCatalog { get; set; } = null!;
}
