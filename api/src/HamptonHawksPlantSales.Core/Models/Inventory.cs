namespace HamptonHawksPlantSales.Core.Models;

public class Inventory : BaseEntity
{
    public Guid PlantCatalogId { get; set; }
    public int OnHandQty { get; set; }

    public PlantCatalog PlantCatalog { get; set; } = null!;
}
