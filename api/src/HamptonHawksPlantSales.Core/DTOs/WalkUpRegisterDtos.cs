namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateDraftRequest
{
    public string? WorkstationName { get; set; }
}

public class ScanIntoDraftRequest
{
    public string PlantBarcode { get; set; } = string.Empty;
    public string ScanId { get; set; } = string.Empty;

    /// <summary>
    /// Number of units to add for this scan. Defaults to 1 for backward
    /// compatibility. Coerced to 1 if &lt;= 0. Capped at the plant's walk-up
    /// availability and on-hand inventory by the service.
    /// </summary>
    public int Quantity { get; set; } = 1;
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
