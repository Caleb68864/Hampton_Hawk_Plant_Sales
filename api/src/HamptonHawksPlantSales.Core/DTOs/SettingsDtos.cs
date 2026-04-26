using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public class SettingsResponse
{
    public bool SaleClosed { get; set; }
    public DateTimeOffset? SaleClosedAt { get; set; }

    // Scanner tuning fields
    public int PickupSearchDebounceMs { get; set; }
    public PickupAutoJumpMode PickupAutoJumpMode { get; set; }
    public bool PickupMultiScanEnabled { get; set; }
}

public class UpdateSaleClosedRequest
{
    public bool SaleClosed { get; set; }
    public string? Reason { get; set; }
}

/// <summary>
/// Request to update scanner tuning settings.
/// All fields are nullable - only provided fields will be updated.
/// </summary>
public class UpdateScannerTuningRequest
{
    /// <summary>
    /// Debounce interval in milliseconds for pickup search input.
    /// Must be between 50 and 500 when provided.
    /// </summary>
    public int? PickupSearchDebounceMs { get; set; }

    /// <summary>
    /// Controls auto-navigation behavior when pickup lookup finds a match.
    /// </summary>
    public PickupAutoJumpMode? PickupAutoJumpMode { get; set; }

    /// <summary>
    /// When true, allows rapid consecutive barcode scans without modal interruption.
    /// </summary>
    public bool? PickupMultiScanEnabled { get; set; }
}
