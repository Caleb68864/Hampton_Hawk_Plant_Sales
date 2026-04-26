using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
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
}
