using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class AppSettings : BaseEntity
{
    public bool SaleClosed { get; set; }
    public DateTimeOffset? SaleClosedAt { get; set; }

    /// <summary>
    /// Debounce interval in milliseconds for pickup search input.
    /// Valid range: 50-500. Default: 120.
    /// </summary>
    public int PickupSearchDebounceMs { get; set; } = 120;

    /// <summary>
    /// Controls auto-navigation behavior when pickup lookup finds a match.
    /// Default: BestMatchWhenSingle.
    /// </summary>
    public PickupAutoJumpMode PickupAutoJumpMode { get; set; } = PickupAutoJumpMode.BestMatchWhenSingle;

    /// <summary>
    /// When true, allows rapid consecutive barcode scans without modal interruption.
    /// Default: true.
    /// </summary>
    public bool PickupMultiScanEnabled { get; set; } = true;
}
