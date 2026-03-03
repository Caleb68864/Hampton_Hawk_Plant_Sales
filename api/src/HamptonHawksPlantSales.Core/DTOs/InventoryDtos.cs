namespace HamptonHawksPlantSales.Core.DTOs;

public class UpdateInventoryRequest
{
    public int OnHandQty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class AdjustInventoryRequest
{
    public Guid PlantId { get; set; }
    public int DeltaQty { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class InventoryResponse
{
    public Guid Id { get; set; }
    public Guid PlantCatalogId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string PlantSku { get; set; } = string.Empty;
    public int OnHandQty { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
