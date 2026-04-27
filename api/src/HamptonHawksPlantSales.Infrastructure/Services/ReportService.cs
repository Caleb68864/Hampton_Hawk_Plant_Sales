using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.DTOs.Reports;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardMetricsResponse> GetDashboardMetricsAsync()
    {
        // SS-05: exclude Draft (walk-up cash-register in-progress) orders from
        // every dashboard aggregate. Drafts are not real revenue/order activity.
        var orders = _db.Orders.Where(o => o.DeletedAt == null && o.Status != OrderStatus.Draft);

        var totalOrders = await orders.CountAsync();
        var openOrders = await orders.CountAsync(o => o.Status == OrderStatus.Open || o.Status == OrderStatus.InProgress);
        var completedOrders = await orders.CountAsync(o => o.Status == OrderStatus.Complete);

        var ordersByStatus = await orders
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var orderLines = _db.OrderLines
            .Where(ol => ol.Order.DeletedAt == null && ol.DeletedAt == null && ol.Order.Status != OrderStatus.Draft);

        var totalItemsOrdered = await orderLines.SumAsync(ol => ol.QtyOrdered);
        var totalItemsFulfilled = await orderLines.SumAsync(ol => ol.QtyFulfilled);

        var saleProgressPercent = totalItemsOrdered > 0
            ? Math.Round((double)totalItemsFulfilled / totalItemsOrdered * 100, 1)
            : 0;

        var totalCustomers = await _db.Customers.CountAsync(c => c.DeletedAt == null);
        var totalSellers = await _db.Sellers.CountAsync(s => s.DeletedAt == null);
        var lowInventoryCount = await _db.Inventories.CountAsync(i => i.DeletedAt == null && i.OnHandQty < 5);
        var problemOrderCount = await orders.CountAsync(o => o.HasIssue);

        return new DashboardMetricsResponse
        {
            TotalOrders = totalOrders,
            OpenOrders = openOrders,
            CompletedOrders = completedOrders,
            TotalCustomers = totalCustomers,
            TotalSellers = totalSellers,
            LowInventoryCount = lowInventoryCount,
            ProblemOrderCount = problemOrderCount,
            OrdersByStatus = ordersByStatus.ToDictionary(x => x.Status.ToString(), x => x.Count),
            TotalItemsOrdered = totalItemsOrdered,
            TotalItemsFulfilled = totalItemsFulfilled,
            SaleProgressPercent = saleProgressPercent
        };
    }

    public async Task<List<LowInventoryResponse>> GetLowInventoryAsync(int threshold = 5)
    {
        return await _db.Inventories
            .Include(i => i.PlantCatalog)
            .Where(i => i.DeletedAt == null && i.PlantCatalog.DeletedAt == null && i.OnHandQty <= threshold)
            .OrderBy(i => i.OnHandQty)
            .Select(i => new LowInventoryResponse
            {
                PlantCatalogId = i.PlantCatalogId,
                PlantName = i.PlantCatalog.Name,
                Sku = i.PlantCatalog.Sku,
                OnHandQty = i.OnHandQty
            })
            .ToListAsync();
    }

    public async Task<List<ProblemOrderResponse>> GetProblemOrdersAsync()
    {
        // SS-05: drafts are filtered out of problem-order listings.
        return await _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Seller)
            .Include(o => o.OrderLines)
            .Where(o => o.DeletedAt == null && o.HasIssue && o.Status != OrderStatus.Draft)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new ProblemOrderResponse
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                CustomerName = o.Customer != null ? o.Customer.DisplayName : string.Empty,
                SellerName = o.Seller != null ? o.Seller.DisplayName : null,
                Status = o.Status,
                LineCount = o.OrderLines.Count(ol => ol.DeletedAt == null),
                CreatedAt = o.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<List<SellerOrderSummaryResponse>> GetSellerOrdersAsync(Guid sellerId)
    {
        // SS-05: drafts are filtered out of per-seller order lists.
        return await _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.OrderLines)
            .Where(o => o.DeletedAt == null && o.SellerId == sellerId && o.Status != OrderStatus.Draft)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new SellerOrderSummaryResponse
            {
                OrderId = o.Id,
                OrderNumber = o.OrderNumber,
                CustomerName = o.Customer != null ? o.Customer.DisplayName : string.Empty,
                Status = o.Status,
                HasIssue = o.HasIssue,
                TotalItemsOrdered = o.OrderLines.Where(ol => ol.DeletedAt == null).Sum(ol => ol.QtyOrdered),
                TotalItemsFulfilled = o.OrderLines.Where(ol => ol.DeletedAt == null).Sum(ol => ol.QtyFulfilled),
                CreatedAt = o.CreatedAt
            })
            .ToListAsync();
    }

    // ── SS-04: Sales aggregate reports ──
    //
    // Soft-delete behavior: AppDbContext applies a global query filter on Order,
    // OrderLine, PlantCatalog, Seller, and Customer (DeletedAt == null), so
    // deleted records are automatically excluded from these queries -- including
    // through navigation properties (e.g. ol.Order, ol.PlantCatalog).
    //
    // Empty/zero-revenue rows are preserved by starting from the parent
    // (Sellers/Customers/PlantCatalogs) and projecting subquery aggregates;
    // a parent with no orders yields OrderCount=0 and Revenue=0 rather than
    // being filtered out (LEFT-JOIN-equivalent semantics).
    //
    // Revenue is computed as Qty * (PlantCatalog.Price ?? 0). Lines for a plant
    // with NULL price contribute 0 revenue rather than producing a NULL total.

    // SS-05: every sales aggregate below excludes Status=Draft so that
    // in-progress walk-up cash-register sessions never inflate revenue or
    // order counts. Draft orders become real revenue only when closed
    // (Status -> Open/Complete) by WalkUpRegisterService.

    public async Task<List<SalesBySellerRow>> GetSalesBySellerAsync()
    {
        return await _db.Sellers
            .OrderBy(s => s.DisplayName)
            .Select(s => new SalesBySellerRow
            {
                SellerId = s.Id,
                SellerDisplayName = s.DisplayName,
                OrderCount = _db.Orders.Count(o => o.SellerId == s.Id && o.Status != OrderStatus.Draft),
                ItemsOrdered = _db.OrderLines
                    .Where(ol => ol.Order.SellerId == s.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyOrdered) ?? 0,
                ItemsFulfilled = _db.OrderLines
                    .Where(ol => ol.Order.SellerId == s.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyFulfilled) ?? 0,
                RevenueOrdered = _db.OrderLines
                    .Where(ol => ol.Order.SellerId == s.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyOrdered * (ol.PlantCatalog.Price ?? 0m))) ?? 0m,
                RevenueFulfilled = _db.OrderLines
                    .Where(ol => ol.Order.SellerId == s.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyFulfilled * (ol.PlantCatalog.Price ?? 0m))) ?? 0m
            })
            .ToListAsync();
    }

    public async Task<List<SalesByCustomerRow>> GetSalesByCustomerAsync()
    {
        return await _db.Customers
            .OrderBy(c => c.DisplayName)
            .Select(c => new SalesByCustomerRow
            {
                CustomerId = c.Id,
                CustomerDisplayName = c.DisplayName,
                OrderCount = _db.Orders.Count(o => o.CustomerId == c.Id && o.Status != OrderStatus.Draft),
                ItemsOrdered = _db.OrderLines
                    .Where(ol => ol.Order.CustomerId == c.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyOrdered) ?? 0,
                ItemsFulfilled = _db.OrderLines
                    .Where(ol => ol.Order.CustomerId == c.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyFulfilled) ?? 0,
                RevenueOrdered = _db.OrderLines
                    .Where(ol => ol.Order.CustomerId == c.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyOrdered * (ol.PlantCatalog.Price ?? 0m))) ?? 0m,
                RevenueFulfilled = _db.OrderLines
                    .Where(ol => ol.Order.CustomerId == c.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyFulfilled * (ol.PlantCatalog.Price ?? 0m))) ?? 0m
            })
            .ToListAsync();
    }

    public async Task<List<SalesByPlantRow>> GetSalesByPlantAsync()
    {
        return await _db.PlantCatalogs
            .OrderBy(p => p.Name)
            .Select(p => new SalesByPlantRow
            {
                PlantCatalogId = p.Id,
                PlantName = p.Name,
                PlantSku = p.Sku,
                OrderCount = _db.OrderLines
                    .Where(ol => ol.PlantCatalogId == p.Id && ol.Order.Status != OrderStatus.Draft)
                    .Select(ol => ol.OrderId)
                    .Distinct()
                    .Count(),
                ItemsOrdered = _db.OrderLines
                    .Where(ol => ol.PlantCatalogId == p.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyOrdered) ?? 0,
                ItemsFulfilled = _db.OrderLines
                    .Where(ol => ol.PlantCatalogId == p.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (int?)ol.QtyFulfilled) ?? 0,
                RevenueOrdered = _db.OrderLines
                    .Where(ol => ol.PlantCatalogId == p.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyOrdered * (p.Price ?? 0m))) ?? 0m,
                RevenueFulfilled = _db.OrderLines
                    .Where(ol => ol.PlantCatalogId == p.Id && ol.Order.Status != OrderStatus.Draft)
                    .Sum(ol => (decimal?)(ol.QtyFulfilled * (p.Price ?? 0m))) ?? 0m
            })
            .ToListAsync();
    }

    // ── SS-02 (Wave 2): Operations / money / inventory aggregations ──
    //
    // All six methods rely on the AppDbContext global query filter for soft
    // delete (DeletedAt == null) and explicitly add Status != Draft so that
    // in-progress walk-up cash-register sessions never inflate the numbers.
    // Date-range bounds (when supplied) are applied at the database level via
    // a DateTimeOffset cast of the inbound DateTime so Npgsql translates
    // cleanly. Where grouping/bucketing isn't reliably translatable across
    // providers (e.g. DateOnly grouping, status-funnel percent rounding),
    // we narrow with a database-side filter first and then complete the
    // aggregation in memory -- the result set is always small (one row per
    // sale day / per status / per plant top-N).

    public async Task<DailySalesResponse> GetDailySalesAsync(DateTime? from, DateTime? to)
    {
        var orders = ApplyOrderRange(BaseOrders(), from, to);

        // Pull just the per-order projection we need; client-side group by date
        // because DateOnly conversion isn't uniformly supported across providers.
        var rows = await orders
            .Select(o => new
            {
                o.Id,
                o.CreatedAt,
                o.IsWalkUp,
                Revenue = o.AmountTendered ?? 0m,
                ItemCount = o.OrderLines
                    .Where(ol => ol.DeletedAt == null)
                    .Sum(ol => (int?)ol.QtyOrdered) ?? 0
            })
            .ToListAsync();

        var days = rows
            .GroupBy(r => DateOnly.FromDateTime(r.CreatedAt.UtcDateTime))
            .OrderBy(g => g.Key)
            .Select(g => new DailySalesDayDto
            {
                Date = g.Key,
                OrderCount = g.Count(),
                ItemCount = g.Sum(r => r.ItemCount),
                Revenue = g.Sum(r => r.Revenue),
                WalkUpCount = g.Count(r => r.IsWalkUp),
                PreorderCount = g.Count(r => !r.IsWalkUp)
            })
            .ToList();

        return new DailySalesResponse { Days = days };
    }

    public async Task<PaymentBreakdownResponse> GetPaymentBreakdownAsync(DateTime? from, DateTime? to)
    {
        var orders = ApplyOrderRange(BaseOrders(), from, to);

        var rows = await orders
            .Select(o => new
            {
                Method = o.PaymentMethod,
                Revenue = o.AmountTendered ?? 0m
            })
            .ToListAsync();

        var methods = rows
            .GroupBy(r => string.IsNullOrWhiteSpace(r.Method) ? "Unspecified" : r.Method!)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var count = g.Count();
                var revenue = g.Sum(r => r.Revenue);
                return new PaymentBreakdownRowDto
                {
                    Method = g.Key,
                    OrderCount = count,
                    Revenue = revenue,
                    AverageOrder = count > 0 ? Math.Round(revenue / count, 2) : 0m
                };
            })
            .ToList();

        return new PaymentBreakdownResponse { Methods = methods };
    }

    public async Task<WalkupVsPreorderResponse> GetWalkupVsPreorderAsync(DateTime? from, DateTime? to)
    {
        var orders = ApplyOrderRange(BaseOrders(), from, to);

        var rows = await orders
            .Select(o => new ChannelOrderProjection
            {
                IsWalkUp = o.IsWalkUp,
                Revenue = o.AmountTendered ?? 0m,
                ItemCount = o.OrderLines
                    .Where(ol => ol.DeletedAt == null)
                    .Sum(ol => (int?)ol.QtyOrdered) ?? 0
            })
            .ToListAsync();

        var walkUp = BuildChannelMetrics(rows.Where(r => r.IsWalkUp));
        var preorder = BuildChannelMetrics(rows.Where(r => !r.IsWalkUp));
        var total = rows.Count;
        var ratio = total > 0 ? Math.Round((double)walkUp.OrderCount / total, 4) : 0d;

        return new WalkupVsPreorderResponse
        {
            WalkUp = walkUp,
            Preorder = preorder,
            WalkUpRatio = ratio
        };
    }

    private sealed class ChannelOrderProjection
    {
        public bool IsWalkUp { get; set; }
        public decimal Revenue { get; set; }
        public int ItemCount { get; set; }
    }

    public async Task<StatusFunnelResponse> GetOrderStatusFunnelAsync()
    {
        var orders = BaseOrders();

        var counts = await orders
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var total = counts.Sum(c => c.Count);

        var buckets = counts
            .OrderBy(c => c.Status)
            .Select(c => new StatusFunnelBucketDto
            {
                Status = c.Status,
                Count = c.Count,
                Percent = total > 0 ? Math.Round((double)c.Count / total * 100, 1) : 0d
            })
            .ToList();

        return new StatusFunnelResponse
        {
            Buckets = buckets,
            Total = total
        };
    }

    public async Task<TopMoversResponse> GetTopMoversAsync(int limit = 25)
    {
        if (limit <= 0)
        {
            limit = 25;
        }

        var lines = _db.OrderLines
            .Where(ol => ol.Order.Status != OrderStatus.Draft);

        var grouped = await lines
            .GroupBy(ol => new { ol.PlantCatalogId, ol.PlantCatalog.Name })
            .Select(g => new TopMoverRowDto
            {
                PlantCatalogId = g.Key.PlantCatalogId,
                PlantName = g.Key.Name,
                QtyOrdered = g.Sum(ol => (int?)ol.QtyOrdered) ?? 0,
                QtyFulfilled = g.Sum(ol => (int?)ol.QtyFulfilled) ?? 0,
                OrderCount = g.Select(ol => ol.OrderId).Distinct().Count()
            })
            .OrderByDescending(r => r.QtyOrdered)
            .ThenBy(r => r.PlantName)
            .Take(limit)
            .ToListAsync();

        return new TopMoversResponse { Plants = grouped };
    }

    public async Task<OutstandingAgingResponse> GetOutstandingAgingAsync()
    {
        var now = DateTimeOffset.UtcNow;

        var open = await _db.Orders
            .Where(o => o.Status == OrderStatus.Open || o.Status == OrderStatus.InProgress)
            .Select(o => o.CreatedAt)
            .ToListAsync();

        // Always emit four buckets (zero-counts are valid) so the UI can render a stable layout.
        var buckets = new List<OutstandingAgingBucketDto>
        {
            new() { Bucket = "<24h" },
            new() { Bucket = "1-3d" },
            new() { Bucket = "3-7d" },
            new() { Bucket = ">7d" }
        };

        foreach (var createdAt in open)
        {
            var ageHours = (now - createdAt).TotalHours;
            var bucket = AgingBucketFor(ageHours);
            var target = buckets.First(b => b.Bucket == bucket);
            target.Count += 1;
            if (ageHours > target.OldestAgeHours)
            {
                target.OldestAgeHours = Math.Round(ageHours, 2);
            }
        }

        return new OutstandingAgingResponse { Buckets = buckets };
    }

    // ── SS-02 (Wave 2) helpers ──

    private IQueryable<Order> BaseOrders() =>
        _db.Orders.Where(o => o.Status != OrderStatus.Draft);

    private static IQueryable<Order> ApplyOrderRange(IQueryable<Order> source, DateTime? from, DateTime? to)
    {
        if (from.HasValue)
        {
            var fromOffset = new DateTimeOffset(DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));
            source = source.Where(o => o.CreatedAt >= fromOffset);
        }
        if (to.HasValue)
        {
            var toOffset = new DateTimeOffset(DateTime.SpecifyKind(to.Value, DateTimeKind.Utc));
            source = source.Where(o => o.CreatedAt < toOffset);
        }
        return source;
    }

    private static ChannelMetricsDto BuildChannelMetrics(IEnumerable<ChannelOrderProjection> rows)
    {
        var list = rows.ToList();
        var count = list.Count;
        var revenue = list.Sum(r => r.Revenue);
        var items = list.Sum(r => r.ItemCount);
        return new ChannelMetricsDto
        {
            OrderCount = count,
            ItemCount = items,
            Revenue = revenue,
            AverageOrder = count > 0 ? Math.Round(revenue / count, 2) : 0m
        };
    }

    private static string AgingBucketFor(double ageHours) => ageHours switch
    {
        < 24 => "<24h",
        < 72 => "1-3d",
        < 168 => "3-7d",
        _ => ">7d"
    };

    // ── Sale-day live KPI dashboard ──
    //
    // One round-trip aggregator powering the projector view. All "today"
    // boundaries use UTC (DateTime.UtcNow.Date) so the result is timezone-stable
    // across clients. Soft-delete is handled by the EF global query filter;
    // Status=Draft is excluded explicitly. Empty data sets degrade gracefully:
    // null-coalescing guards return 0/null instead of throwing, and the hourly
    // sparkline is always 12 buckets wide so the UI never rejiggers.

    public async Task<LiveSaleKpiResponse> GetLiveSaleKpiAsync()
    {
        var now = DateTimeOffset.UtcNow;
        var todayStart = new DateTimeOffset(DateTime.UtcNow.Date, TimeSpan.Zero);
        var tomorrowStart = todayStart.AddDays(1);
        var hourAgo = now.AddHours(-1);

        var orders = BaseOrders();

        var totalRevenue = await orders.SumAsync(o => (decimal?)(o.AmountTendered ?? 0m)) ?? 0m;
        var totalOrdersToday = await orders.CountAsync(o => o.CreatedAt >= todayStart && o.CreatedAt < tomorrowStart);
        var ordersCompleted = await orders.CountAsync(o => o.Status == OrderStatus.Complete);
        var ordersOpen = await orders.CountAsync(o => o.Status == OrderStatus.Open || o.Status == OrderStatus.InProgress);

        var itemsScannedTotal = await _db.OrderLines
            .Where(ol => ol.Order.Status != OrderStatus.Draft)
            .SumAsync(ol => (int?)ol.QtyFulfilled) ?? 0;

        // FulfillmentEvent base scope: exclude events whose parent order is
        // soft-deleted (covered by global filter on Order via the navigation)
        // or in Draft status. Draft orders shouldn't be producing real scans
        // but we filter defensively.
        var acceptedEvents = _db.FulfillmentEvents
            .Where(e => e.Result == FulfillmentResult.Accepted
                        && e.Order.Status != OrderStatus.Draft);

        var itemsScannedToday = await acceptedEvents
            .Where(e => e.CreatedAt >= todayStart && e.CreatedAt < tomorrowStart)
            .SumAsync(e => (int?)e.Quantity) ?? 0;

        var scansLastHour = await acceptedEvents.CountAsync(e => e.CreatedAt >= hourAgo);

        // Mean seconds between scans: pull last 100 Accepted timestamps then
        // compute consecutive deltas in memory. Null when we don't have at
        // least two events to form a single delta.
        var recentTimestamps = await acceptedEvents
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => e.CreatedAt)
            .Take(100)
            .ToListAsync();

        double? meanSecondsBetweenScans = null;
        if (recentTimestamps.Count >= 2)
        {
            // recentTimestamps is descending; reverse for chronological diffs.
            var ordered = recentTimestamps.OrderBy(t => t).ToList();
            var deltas = new List<double>(ordered.Count - 1);
            for (var i = 1; i < ordered.Count; i++)
            {
                deltas.Add((ordered[i] - ordered[i - 1]).TotalSeconds);
            }
            meanSecondsBetweenScans = Math.Round(deltas.Average(), 2);
        }

        // Average order pickup time: per Complete order completed today,
        // measure (Order.UpdatedAt - earliest FulfillmentEvent.CreatedAt for
        // that order). Null when zero orders completed today.
        var completedToday = await _db.Orders
            .Where(o => o.Status == OrderStatus.Complete
                        && o.UpdatedAt >= todayStart && o.UpdatedAt < tomorrowStart)
            .Select(o => new
            {
                o.Id,
                o.UpdatedAt,
                FirstScanAt = _db.FulfillmentEvents
                    .Where(e => e.OrderId == o.Id)
                    .Min(e => (DateTimeOffset?)e.CreatedAt)
            })
            .ToListAsync();

        double? averageOrderPickupSeconds = null;
        var pickupSpans = completedToday
            .Where(x => x.FirstScanAt.HasValue && x.UpdatedAt >= x.FirstScanAt.Value)
            .Select(x => (x.UpdatedAt - x.FirstScanAt!.Value).TotalSeconds)
            .ToList();
        if (pickupSpans.Count > 0)
        {
            averageOrderPickupSeconds = Math.Round(pickupSpans.Average(), 2);
        }

        // Last scan + plant name: most recent Accepted event overall.
        var lastScan = await acceptedEvents
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new
            {
                e.CreatedAt,
                PlantName = e.PlantCatalog != null ? e.PlantCatalog.Name : null
            })
            .FirstOrDefaultAsync();

        // Top movers today: top 5 by SUM(Quantity), joined to plant name.
        var topMovers = await acceptedEvents
            .Where(e => e.CreatedAt >= todayStart && e.CreatedAt < tomorrowStart
                        && e.PlantCatalogId != null)
            .GroupBy(e => new { e.PlantCatalogId, Name = e.PlantCatalog!.Name })
            .Select(g => new TopMoverLiveRow
            {
                PlantName = g.Key.Name,
                QtyScanned = g.Sum(e => e.Quantity)
            })
            .OrderByDescending(r => r.QtyScanned)
            .ThenBy(r => r.PlantName)
            .Take(5)
            .ToListAsync();

        // Hourly activity: last 12 hour-aligned buckets. Pull events from the
        // earliest bucket forward then bucket in memory so zero-count buckets
        // are preserved (DB-side group-by would drop empty hours).
        var currentHourStart = new DateTimeOffset(
            now.Year, now.Month, now.Day, now.Hour, 0, 0, TimeSpan.Zero);
        var earliestBucket = currentHourStart.AddHours(-11);

        var hourEvents = await acceptedEvents
            .Where(e => e.CreatedAt >= earliestBucket)
            .Select(e => new { e.CreatedAt, e.Quantity })
            .ToListAsync();

        var hourBuckets = new List<ScanActivityHourBucket>(12);
        for (var i = 0; i < 12; i++)
        {
            var bucketStart = earliestBucket.AddHours(i);
            var bucketEnd = bucketStart.AddHours(1);
            var inBucket = hourEvents.Where(e => e.CreatedAt >= bucketStart && e.CreatedAt < bucketEnd).ToList();
            hourBuckets.Add(new ScanActivityHourBucket
            {
                HourStart = bucketStart,
                ScanCount = inBucket.Count,
                ItemsScanned = inBucket.Sum(e => e.Quantity)
            });
        }

        // Recent scans ticker: last 8 Accepted events with plant + order labels.
        var recentScans = await acceptedEvents
            .OrderByDescending(e => e.CreatedAt)
            .Take(8)
            .Select(e => new RecentScanEntry
            {
                At = e.CreatedAt,
                PlantName = e.PlantCatalog != null ? e.PlantCatalog.Name : string.Empty,
                Quantity = e.Quantity,
                OrderNumber = e.Order.OrderNumber
            })
            .ToListAsync();

        return new LiveSaleKpiResponse
        {
            TotalSalesRevenue = totalRevenue,
            TotalOrdersToday = totalOrdersToday,
            OrdersCompleted = ordersCompleted,
            OrdersOpen = ordersOpen,
            ItemsScannedTotal = itemsScannedTotal,
            ItemsScannedToday = itemsScannedToday,
            ScansLastHour = scansLastHour,
            MeanSecondsBetweenScans = meanSecondsBetweenScans,
            AverageOrderPickupSeconds = averageOrderPickupSeconds,
            LastScanAt = lastScan?.CreatedAt,
            LastScanPlantName = lastScan?.PlantName,
            TopMovers = topMovers,
            HourlyActivity = hourBuckets,
            RecentScans = recentScans
        };
    }
}
