using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Walk-up cash-register draft endpoints.
/// </summary>
[ApiController]
[Route("api/walkup-register")]
[Authorize(Policy = "POSCapable")]
public class WalkUpRegisterController : ControllerBase
{
    private readonly IWalkUpRegisterService _service;

    public WalkUpRegisterController(IWalkUpRegisterService service)
    {
        _service = service;
    }

    /// <summary>
    /// Creates a new walk-up draft order.
    /// </summary>
    [HttpPost("draft")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> CreateDraft([FromBody] CreateDraftRequest? request)
    {
        var result = await _service.CreateDraftAsync(request ?? new CreateDraftRequest());
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Scans a plant into a draft (decrements inventory, upserts the line, idempotent on scanId).
    /// </summary>
    [HttpPost("draft/{id:guid}/scan")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> Scan(Guid id, [FromBody] ScanIntoDraftRequest request)
    {
        var result = await _service.ScanIntoDraftAsync(id, request);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Adjusts a line on the draft. May require admin pin/reason if increasing past walk-up availability.
    /// </summary>
    [HttpPatch("draft/{id:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> AdjustLine(Guid id, Guid lineId, [FromBody] AdjustLineRequest request)
    {
        var pin = Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = Request.Headers["X-Admin-Reason"].FirstOrDefault();
        var result = await _service.AdjustLineAsync(id, lineId, request, pin, reason);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Voids a line on the draft (admin pin required).
    /// </summary>
    [HttpDelete("draft/{id:guid}/lines/{lineId:guid}")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> VoidLine(Guid id, Guid lineId)
    {
        var reason = (HttpContext.Items["AdminReason"] as string)
            ?? Request.Headers["X-Admin-Reason"].FirstOrDefault()
            ?? string.Empty;
        var result = await _service.VoidLineAsync(id, lineId, reason);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Closes the draft, persisting payment metadata.
    /// </summary>
    [HttpPost("draft/{id:guid}/close")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> Close(Guid id, [FromBody] CloseDraftRequest? request)
    {
        var result = await _service.CloseDraftAsync(id, request ?? new CloseDraftRequest());
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Cancels the draft, restoring inventory and soft-deleting the order (admin pin required).
    /// </summary>
    [HttpPost("draft/{id:guid}/cancel")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var reason = (HttpContext.Items["AdminReason"] as string)
            ?? Request.Headers["X-Admin-Reason"].FirstOrDefault()
            ?? string.Empty;
        var result = await _service.CancelDraftAsync(id, reason);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Returns open drafts (optionally scoped to a workstation name).
    /// </summary>
    [HttpGet("draft/open")]
    [ProducesResponseType(typeof(ApiResponse<List<OrderResponse>>), 200)]
    public async Task<IActionResult> GetOpenDrafts([FromQuery] string? workstationName)
    {
        var result = await _service.GetOpenDraftsAsync(workstationName);
        return Ok(ApiResponse<List<OrderResponse>>.Ok(result));
    }
}
