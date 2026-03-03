using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Handles order fulfillment: scanning, completing, and resetting orders at the pickup station.
/// </summary>
[ApiController]
[Route("api/orders")]
public class FulfillmentController : ControllerBase
{
    private readonly IFulfillmentService _fulfillmentService;

    public FulfillmentController(IFulfillmentService fulfillmentService)
    {
        _fulfillmentService = fulfillmentService;
    }

    /// <summary>
    /// Processes a barcode scan against an order, fulfilling matching line items.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <param name="request">Barcode value to scan.</param>
    /// <response code="200">Scan result with match details and updated order state.</response>
    [HttpPost("{id:guid}/scan")]
    [ProducesResponseType(typeof(ApiResponse<ScanResponse>), 200)]
    public async Task<IActionResult> Scan(Guid id, [FromBody] ScanRequest request)
    {
        var result = await _fulfillmentService.ScanAsync(id, request.Barcode);
        return Ok(ApiResponse<ScanResponse>.Ok(result));
    }

    /// <summary>
    /// Undoes the most recent scan on an order, decrementing the fulfilled quantity.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">Updated scan state after undo.</response>
    [HttpPost("{id:guid}/undo-last-scan")]
    [ProducesResponseType(typeof(ApiResponse<ScanResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<ScanResponse>), 400)]
    public async Task<IActionResult> UndoLastScan(Guid id)
    {
        var reason = Request.Headers["X-Admin-Reason"].FirstOrDefault() ?? "Undo last accepted scan";
        var operatorName = Request.Headers["X-Operator"].FirstOrDefault() ?? "Pickup Operator";
        var result = await _fulfillmentService.UndoLastScanAsync(id, reason, operatorName);
        if (result.Result == FulfillmentResult.SaleClosedBlocked)
            return BadRequest(ApiResponse<ScanResponse>.Fail("Sale is closed."));
        return Ok(ApiResponse<ScanResponse>.Ok(result));
    }

    /// <summary>
    /// Marks an order as complete when all lines are fully fulfilled.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">Order completed successfully.</response>
    [HttpPost("{id:guid}/complete")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    public async Task<IActionResult> Complete(Guid id)
    {
        await _fulfillmentService.CompleteOrderAsync(id);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    /// <summary>
    /// Force-completes an order even with unfulfilled lines. Requires admin PIN.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">Order force-completed.</response>
    [HttpPost("{id:guid}/force-complete")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 403)]
    public async Task<IActionResult> ForceComplete(Guid id)
    {
        var reason = HttpContext.Items["AdminReason"] as string ?? string.Empty;
        var operatorName = Request.Headers["X-Operator"].FirstOrDefault() ?? "Admin Operator";
        await _fulfillmentService.ForceCompleteOrderAsync(id, reason, operatorName);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    /// <summary>
    /// Resets an order back to Open status, clearing all fulfillment progress. Requires admin PIN.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">Order reset to Open.</response>
    [HttpPost("{id:guid}/reset")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    public async Task<IActionResult> Reset(Guid id)
    {
        var reason = HttpContext.Items["AdminReason"] as string ?? string.Empty;
        var operatorName = Request.Headers["X-Operator"].FirstOrDefault() ?? "Admin Operator";
        await _fulfillmentService.ResetOrderAsync(id, reason, operatorName);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    /// <summary>
    /// Gets the fulfillment event history for an order (scans, undos, completions).
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">List of fulfillment events.</response>
    [HttpGet("{id:guid}/events")]
    [ProducesResponseType(typeof(ApiResponse<List<FulfillmentEventResponse>>), 200)]
    public async Task<IActionResult> GetEvents(Guid id)
    {
        var events = await _fulfillmentService.GetEventsAsync(id);
        return Ok(ApiResponse<List<FulfillmentEventResponse>>.Ok(events));
    }
}
