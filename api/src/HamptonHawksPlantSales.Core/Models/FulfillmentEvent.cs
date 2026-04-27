using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class FulfillmentEvent : EventEntity
{
    public Guid OrderId { get; set; }
    public Guid? PlantCatalogId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public FulfillmentResult Result { get; set; }
    public string? Message { get; set; }

    /// <summary>
    /// Multi-quantity scan tracking: number of units affected by this event.
    /// Defaults to 1 to preserve historical event semantics. A single accepted
    /// scan with quantity=N records ONE event with Quantity=N rather than N
    /// individual events (cleaner audit trail, matches volunteer intent).
    /// Undo events follow the same convention.
    /// </summary>
    public int Quantity { get; set; } = 1;

    public Order Order { get; set; } = null!;
    public PlantCatalog? PlantCatalog { get; set; }
}
