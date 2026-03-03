using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class FulfillmentEvent : EventEntity
{
    public Guid OrderId { get; set; }
    public Guid? PlantCatalogId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public FulfillmentResult Result { get; set; }
    public string? Message { get; set; }

    public Order Order { get; set; } = null!;
    public PlantCatalog? PlantCatalog { get; set; }
}
