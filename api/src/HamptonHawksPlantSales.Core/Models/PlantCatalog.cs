namespace HamptonHawksPlantSales.Core.Models;

public class PlantCatalog : BaseEntity
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Variant { get; set; }
    public decimal? Price { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public DateTimeOffset? BarcodeLockedAt { get; set; }
    public bool IsActive { get; set; } = true;
}
