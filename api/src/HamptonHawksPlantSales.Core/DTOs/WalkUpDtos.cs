namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateWalkUpOrderRequest
{
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Notes { get; set; }
    public Guid? CustomerId { get; set; }
}

public class AddWalkUpLineRequest
{
    public Guid PlantCatalogId { get; set; }

    private int _qtyOrdered;
    public int QtyOrdered
    {
        get => _qtyOrdered;
        set => _qtyOrdered = value;
    }

    // Alias for QtyOrdered to support both field names
    public int? Qty
    {
        get => _qtyOrdered;
        set { if (value.HasValue) _qtyOrdered = value.Value; }
    }

    public string? Notes { get; set; }
}

public class UpdateWalkUpLineRequest
{
    public Guid PlantCatalogId { get; set; }
    public int QtyOrdered { get; set; }
    public string? Notes { get; set; }
}

public class WalkUpAvailabilityResponse
{
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string PlantSku { get; set; } = string.Empty;
    public int OnHandQty { get; set; }
    public int PreorderRemaining { get; set; }
    public int AvailableForWalkup { get; set; }
}
