namespace HamptonHawksPlantSales.Core.Models;

public class InventoryAdjustment : EventEntity, IUserAttributed
{
    /// <summary>Signed-in account that caused this row (stamped on insert).</summary>
    public Guid? UserId { get; set; }
    public Guid PlantCatalogId { get; set; }
    public int DeltaQty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }

    public PlantCatalog PlantCatalog { get; set; } = null!;
}
