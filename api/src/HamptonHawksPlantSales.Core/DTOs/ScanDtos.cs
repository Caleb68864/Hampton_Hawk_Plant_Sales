using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public class ScanRequest
{
    public string Barcode { get; set; } = string.Empty;

    /// <summary>
    /// Multi-quantity scanning: number of units to fulfill in one scan.
    /// Defaults to 1 for backward compatibility. Values &lt;= 0 are coerced to 1
    /// by the service. The service caps the applied count at the line's
    /// remaining quantity (multi-line aggregation distributes greedily).
    /// </summary>
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// Optional client-generated id identifying this scan attempt. The client keeps it
    /// stable across retries of the same physical scan, so a resubmitted request is
    /// recognised as a replay instead of fulfilling a second unit. Omit it and the
    /// endpoint behaves exactly as before.
    /// </summary>
    public string? ScanId { get; set; }
}

public class ManualFulfillRequest
{
    public Guid OrderLineId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
}

public class ScanResponse
{
    public FulfillmentResult Result { get; set; }
    public Guid? OrderId { get; set; }
    public ScanPlantInfo? Plant { get; set; }
    public ScanLineInfo? Line { get; set; }
    public int OrderRemainingItems { get; set; }
}

public class ScanPlantInfo
{
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class ScanLineInfo
{
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public int QtyRemaining { get; set; }
}

public class FulfillmentEventResponse
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid? PlantCatalogId { get; set; }
    public string Barcode { get; set; } = string.Empty;
    public FulfillmentResult Result { get; set; }
    public string? Message { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
