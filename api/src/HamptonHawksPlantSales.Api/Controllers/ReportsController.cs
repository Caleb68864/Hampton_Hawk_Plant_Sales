using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.DTOs.Reports;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Read-only reporting endpoints for dashboards and diagnostics.
/// </summary>
[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    /// <summary>
    /// Gets dashboard summary metrics (total orders, fulfillment progress, etc.).
    /// </summary>
    /// <response code="200">Dashboard metrics.</response>
    [HttpGet("dashboard-metrics")]
    [ProducesResponseType(typeof(ApiResponse<DashboardMetricsResponse>), 200)]
    public async Task<IActionResult> GetDashboardMetrics()
    {
        var result = await _reportService.GetDashboardMetricsAsync();
        return Ok(ApiResponse<DashboardMetricsResponse>.Ok(result));
    }

    /// <summary>
    /// Gets plants with inventory below the specified threshold.
    /// </summary>
    /// <param name="threshold">Low inventory threshold (default 5).</param>
    /// <response code="200">List of low-inventory plants.</response>
    [HttpGet("low-inventory")]
    [ProducesResponseType(typeof(ApiResponse<List<LowInventoryResponse>>), 200)]
    public async Task<IActionResult> GetLowInventory([FromQuery] int threshold = 5)
    {
        var result = await _reportService.GetLowInventoryAsync(threshold);
        return Ok(ApiResponse<List<LowInventoryResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets orders that have issues (e.g., over-fulfilled, stalled).
    /// </summary>
    /// <response code="200">List of problem orders.</response>
    [HttpGet("problem-orders")]
    [ProducesResponseType(typeof(ApiResponse<List<ProblemOrderResponse>>), 200)]
    public async Task<IActionResult> GetProblemOrders()
    {
        var result = await _reportService.GetProblemOrdersAsync();
        return Ok(ApiResponse<List<ProblemOrderResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets order summaries for a specific seller.
    /// </summary>
    /// <param name="sellerId">Seller ID.</param>
    /// <response code="200">List of seller's order summaries.</response>
    [HttpGet("seller/{sellerId:guid}/orders")]
    [ProducesResponseType(typeof(ApiResponse<List<SellerOrderSummaryResponse>>), 200)]
    public async Task<IActionResult> GetSellerOrders(Guid sellerId)
    {
        var result = await _reportService.GetSellerOrdersAsync(sellerId);
        return Ok(ApiResponse<List<SellerOrderSummaryResponse>>.Ok(result));
    }

    // ── SS-04: Sales aggregate reports ──

    /// <summary>
    /// Gets aggregated sales totals grouped by seller.
    /// </summary>
    /// <response code="200">List of per-seller sales totals.</response>
    [HttpGet("sales-by-seller")]
    [ProducesResponseType(typeof(ApiResponse<List<SalesBySellerRow>>), 200)]
    public async Task<IActionResult> GetSalesBySeller()
    {
        var result = await _reportService.GetSalesBySellerAsync();
        return Ok(ApiResponse<List<SalesBySellerRow>>.Ok(result));
    }

    /// <summary>
    /// Gets aggregated sales totals grouped by customer.
    /// </summary>
    /// <response code="200">List of per-customer sales totals.</response>
    [HttpGet("sales-by-customer")]
    [ProducesResponseType(typeof(ApiResponse<List<SalesByCustomerRow>>), 200)]
    public async Task<IActionResult> GetSalesByCustomer()
    {
        var result = await _reportService.GetSalesByCustomerAsync();
        return Ok(ApiResponse<List<SalesByCustomerRow>>.Ok(result));
    }

    /// <summary>
    /// Gets aggregated sales totals grouped by plant catalog item.
    /// </summary>
    /// <response code="200">List of per-plant sales totals.</response>
    [HttpGet("sales-by-plant")]
    [ProducesResponseType(typeof(ApiResponse<List<SalesByPlantRow>>), 200)]
    public async Task<IActionResult> GetSalesByPlant()
    {
        var result = await _reportService.GetSalesByPlantAsync();
        return Ok(ApiResponse<List<SalesByPlantRow>>.Ok(result));
    }

    // ── SS-02 (Wave 2): Operations / money / inventory aggregations ──

    /// <summary>
    /// Gets per-day order counts, item counts, revenue, and walk-up vs preorder split.
    /// </summary>
    /// <param name="from">Optional inclusive lower bound on order CreatedAt (UTC).</param>
    /// <param name="to">Optional exclusive upper bound on order CreatedAt (UTC).</param>
    [HttpGet("daily-sales")]
    [ProducesResponseType(typeof(ApiResponse<DailySalesResponse>), 200)]
    public async Task<IActionResult> GetDailySales([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var result = await _reportService.GetDailySalesAsync(from, to);
        return Ok(ApiResponse<DailySalesResponse>.Ok(result));
    }

    /// <summary>
    /// Gets order count and revenue grouped by payment method.
    /// </summary>
    [HttpGet("payment-breakdown")]
    [ProducesResponseType(typeof(ApiResponse<PaymentBreakdownResponse>), 200)]
    public async Task<IActionResult> GetPaymentBreakdown([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var result = await _reportService.GetPaymentBreakdownAsync(from, to);
        return Ok(ApiResponse<PaymentBreakdownResponse>.Ok(result));
    }

    /// <summary>
    /// Gets order/item/revenue totals split by walk-up vs preorder channel.
    /// </summary>
    [HttpGet("walkup-vs-preorder")]
    [ProducesResponseType(typeof(ApiResponse<WalkupVsPreorderResponse>), 200)]
    public async Task<IActionResult> GetWalkupVsPreorder([FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
    {
        var result = await _reportService.GetWalkupVsPreorderAsync(from, to);
        return Ok(ApiResponse<WalkupVsPreorderResponse>.Ok(result));
    }

    /// <summary>
    /// Gets order counts per OrderStatus (excluding Draft) plus percentage of total.
    /// </summary>
    [HttpGet("status-funnel")]
    [ProducesResponseType(typeof(ApiResponse<StatusFunnelResponse>), 200)]
    public async Task<IActionResult> GetStatusFunnel()
    {
        var result = await _reportService.GetOrderStatusFunnelAsync();
        return Ok(ApiResponse<StatusFunnelResponse>.Ok(result));
    }

    /// <summary>
    /// Gets the top-moving plants by ordered quantity.
    /// </summary>
    /// <param name="limit">Maximum rows to return (default 25).</param>
    [HttpGet("top-movers")]
    [ProducesResponseType(typeof(ApiResponse<TopMoversResponse>), 200)]
    public async Task<IActionResult> GetTopMovers([FromQuery] int limit = 25)
    {
        var result = await _reportService.GetTopMoversAsync(limit);
        return Ok(ApiResponse<TopMoversResponse>.Ok(result));
    }

    /// <summary>
    /// Gets aging buckets for outstanding (Open / InProgress) orders.
    /// </summary>
    [HttpGet("outstanding-aging")]
    [ProducesResponseType(typeof(ApiResponse<OutstandingAgingResponse>), 200)]
    public async Task<IActionResult> GetOutstandingAging()
    {
        var result = await _reportService.GetOutstandingAgingAsync();
        return Ok(ApiResponse<OutstandingAgingResponse>.Ok(result));
    }
}
