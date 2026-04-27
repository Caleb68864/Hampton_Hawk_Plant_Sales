namespace HamptonHawksPlantSales.Core.Enums;

/// <summary>
/// Controls how pickup lookup handles automatic navigation when a search matches.
/// </summary>
public enum PickupAutoJumpMode
{
    /// <summary>
    /// Only auto-jump when the search is an exact match on orderNumber or barcode.
    /// Does not auto-jump on partial matches or best-guess scenarios.
    /// </summary>
    ExactMatchOnly = 0,

    /// <summary>
    /// Auto-jump when there is exactly one search result,
    /// even if the match is a best-guess on orderNumber or barcode.
    /// </summary>
    BestMatchWhenSingle = 1
}
