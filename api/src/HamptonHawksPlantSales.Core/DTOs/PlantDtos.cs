namespace HamptonHawksPlantSales.Core.DTOs;

public class CreatePlantRequest
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Variant { get; set; }
    public decimal? Price { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class UpdatePlantRequest
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Variant { get; set; }
    public decimal? Price { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class PlantResponse
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Variant { get; set; }
    public decimal? Price { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTimeOffset? BarcodeLockedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}
