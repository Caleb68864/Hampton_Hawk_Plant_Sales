namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// Sale-day live KPI dashboard response. Designed for projector-friendly
// auto-refreshing display during a sale. Aggregates revenue, scan tempo, and
// fulfillment activity in a single round-trip so the frontend can poll one
// endpoint every few seconds without amplifying load.
//
// Soft-delete records are excluded by AppDbContext global query filters.
// Status=Draft orders are excluded explicitly (they represent in-progress
// walk-up cash-register sessions, not realized revenue).
//
// Time semantics: all "today" filters use UTC (DateTime.UtcNow.Date). The
// projector display assumes a single sale day's worth of UTC events covers
// the working hours; a future enhancement could parameterize the day window.

public class LiveSaleKpiResponse
{
    /// <summary>SUM(AmountTendered) across all non-Draft orders.</summary>
    public decimal TotalSalesRevenue { get; set; }

    /// <summary>Count of non-Draft orders created today (UTC).</summary>
    public int TotalOrdersToday { get; set; }

    /// <summary>Count of orders in Status == Complete.</summary>
    public int OrdersCompleted { get; set; }

    /// <summary>Count of orders in Status == Open or Status == InProgress.</summary>
    public int OrdersOpen { get; set; }

    /// <summary>SUM(QtyFulfilled) across all order lines (non-Draft orders).</summary>
    public int ItemsScannedTotal { get; set; }

    /// <summary>SUM(FulfillmentEvent.Quantity) for Accepted events created today (UTC).</summary>
    public int ItemsScannedToday { get; set; }

    /// <summary>Count of Accepted FulfillmentEvents in the last 60 minutes.</summary>
    public int ScansLastHour { get; set; }

    /// <summary>
    /// Mean seconds between consecutive Accepted scan events over the last
    /// 100 events (most-recent-first). Null if fewer than 2 events exist.
    /// </summary>
    public double? MeanSecondsBetweenScans { get; set; }

    /// <summary>
    /// Mean (Order.UpdatedAt - earliest FulfillmentEvent.CreatedAt) in seconds
    /// across orders that completed today. Null when zero orders completed today.
    /// </summary>
    public double? AverageOrderPickupSeconds { get; set; }

    /// <summary>Most recent Accepted FulfillmentEvent timestamp (any time, not just today).</summary>
    public DateTimeOffset? LastScanAt { get; set; }

    /// <summary>Plant name for the most recent Accepted FulfillmentEvent.</summary>
    public string? LastScanPlantName { get; set; }

    /// <summary>Top 5 plants today by SUM(Quantity) of Accepted scan events.</summary>
    public List<TopMoverLiveRow> TopMovers { get; set; } = new();

    /// <summary>
    /// Last 12 hour-aligned buckets (oldest first). Includes zero-count buckets
    /// so the sparkline renders a stable 12-point series.
    /// </summary>
    public List<ScanActivityHourBucket> HourlyActivity { get; set; } = new();

    /// <summary>Last 8 Accepted FulfillmentEvents (most-recent first).</summary>
    public List<RecentScanEntry> RecentScans { get; set; } = new();
}

public class TopMoverLiveRow
{
    public string PlantName { get; set; } = string.Empty;
    public int QtyScanned { get; set; }
}

public class ScanActivityHourBucket
{
    public DateTimeOffset HourStart { get; set; }
    public int ScanCount { get; set; }
    public int ItemsScanned { get; set; }
}

public class RecentScanEntry
{
    public DateTimeOffset At { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
}
