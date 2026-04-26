namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateDraftRequest
{
    public string? WorkstationName { get; set; }
}

public class ScanIntoDraftRequest
{
    public string PlantBarcode { get; set; } = string.Empty;
    public string ScanId { get; set; } = string.Empty;
}

public class AdjustLineRequest
{
    public Guid PlantCatalogId { get; set; }
    public int NewQty { get; set; }
}

public class CloseDraftRequest
{
    public string? PaymentMethod { get; set; }
    public decimal? AmountTendered { get; set; }
}
