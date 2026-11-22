using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class FulfillmentEvent : EventEntity, IUserAttributed
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

    /// <summary>
    /// Client-supplied scan id, recorded only on Accepted events. A retried request
    /// carrying a scan id already present on this order is a replay of one scan, not
    /// a second scan, and must not decrement inventory again. Null for events from
    /// clients that do not send an id, and for non-mutating outcomes (NotFound,
    /// WrongOrder, AlreadyFulfilled) which are safe to re-evaluate.
    /// </summary>
    public string? IdempotencyKey { get; set; }

    /// <summary>
    /// The signed-in account that caused this event (an <c>AppUser.Id</c>; sale-day
    /// accounts are per station). Null for rows written before this column existed or
    /// outside an authenticated request. Deliberately not a foreign key: the audit row
    /// must outlive the account, and an insert should not lock the user row.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>Which server write path recorded the event. Null on older rows.</summary>
    public FulfillmentEventSource? Source { get; set; }

    public Order Order { get; set; } = null!;
    public PlantCatalog? PlantCatalog { get; set; }
}
