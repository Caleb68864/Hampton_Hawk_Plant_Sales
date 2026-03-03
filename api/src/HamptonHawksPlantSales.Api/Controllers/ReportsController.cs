using HamptonHawksPlantSales.Core.DTOs;
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
}
