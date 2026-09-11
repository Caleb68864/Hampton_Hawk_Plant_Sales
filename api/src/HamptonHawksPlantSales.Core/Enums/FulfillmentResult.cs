namespace HamptonHawksPlantSales.Core.Enums;

public enum FulfillmentResult
{
    Accepted,
    NotFound,
    WrongOrder,
    AlreadyFulfilled,
    SaleClosedBlocked,
    OutOfStock,
    /// <summary>
    /// Audit record written when an accepted scan is reversed. Distinct from
    /// <see cref="Accepted"/> so a later undo cannot select the reversal itself as
    /// "the last accepted scan" and so scan-count reports do not count it.
    /// </summary>
    Undone
}
