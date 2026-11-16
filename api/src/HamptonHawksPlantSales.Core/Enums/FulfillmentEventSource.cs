namespace HamptonHawksPlantSales.Core.Enums;

/// <summary>
/// Which write path recorded a fulfillment event. Set by the server, never taken from
/// the client. Null on rows written before the column existed.
/// </summary>
public enum FulfillmentEventSource
{
    /// <summary>A barcode/SKU scan against one order (<c>/api/orders/{id}/scan</c>).</summary>
    PickupScan = 0,

    /// <summary>A scan inside a pick-list scan session.</summary>
    SessionScan = 1,

    /// <summary>Manual fulfil from the order screen (no barcode).</summary>
    ManualFulfill = 2,

    /// <summary>Undo of the last accepted scan.</summary>
    Undo = 3
}
