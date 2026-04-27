using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateScanSessionRequest
{
    public string ScannedBarcode { get; set; } = string.Empty;
    public string WorkstationName { get; set; } = string.Empty;
}

public class ScanInSessionRequest
{
    public string PlantBarcode { get; set; } = string.Empty;

    /// <summary>
    /// Multi-quantity scanning: number of units to fulfill in one scan.
    /// Defaults to 1 for backward compatibility. Values &lt;= 0 are coerced to 1
    /// by the service. The service distributes the requested quantity across
    /// the matching lines greedily (oldest order, then oldest line first).
    /// </summary>
    public int Quantity { get; set; } = 1;
}

public class ScanSessionResponse
{
    public Guid Id { get; set; }
    public ScanSessionEntityKind EntityKind { get; set; }
    public Guid? EntityId { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string WorkstationName { get; set; } = string.Empty;
    public List<Guid> IncludedOrderIds { get; set; } = new();
    public List<ScanSessionAggregatedLine> AggregatedLines { get; set; } = new();
    public int RemainingTotal { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

public class ScanSessionAggregatedLine
{
    public Guid PlantCatalogId { get; set; }
    public string PlantSku { get; set; } = string.Empty;
    public string PlantName { get; set; } = string.Empty;
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public int QtyRemaining { get; set; }
}

public class ScanSessionScanResponse
{
    public ScanSessionResult Result { get; set; }
    public string? Message { get; set; }
    public ScanPlantInfo? Plant { get; set; }
    public ScanSessionResponse Session { get; set; } = new();
}
