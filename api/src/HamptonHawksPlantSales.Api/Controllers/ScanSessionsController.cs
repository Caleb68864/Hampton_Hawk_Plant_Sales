using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Pick-list scan session endpoints. Sessions aggregate a customer's or seller's open orders
/// for multi-order pickup scanning.
/// </summary>
[ApiController]
[Route("api/scan-sessions")]
[Authorize(Policy = "PickupCapable")]
public class ScanSessionsController : ControllerBase
{
    private readonly IScanSessionService _service;

    public ScanSessionsController(IScanSessionService service)
    {
        _service = service;
    }

    /// <summary>
    /// Creates a new scan session from a PLB-/PLS- pick-list barcode.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ScanSessionResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    [ProducesResponseType(typeof(ApiResponse<object>), 422)]
    public async Task<IActionResult> Create([FromBody] CreateScanSessionRequest request)
    {
        try
        {
            var session = await _service.CreateFromPicklistAsync(request.ScannedBarcode, request.WorkstationName);
            return Ok(ApiResponse<ScanSessionResponse>.Ok(session));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
        catch (ValidationException ex)
        {
            return UnprocessableEntity(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Gets the current state of a scan session including aggregated remaining lines.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ScanSessionResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> Get(Guid id)
    {
        try
        {
            var session = await _service.GetAsync(id);
            return Ok(ApiResponse<ScanSessionResponse>.Ok(session));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Records a plant scan against a session. Routes to the oldest pending matching line.
    /// </summary>
    [HttpPost("{id:guid}/scan")]
    [ProducesResponseType(typeof(ApiResponse<ScanSessionScanResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    [ProducesResponseType(typeof(ApiResponse<object>), 410)]
    public async Task<IActionResult> Scan(Guid id, [FromBody] ScanInSessionRequest request)
    {
        try
        {
            // Multi-quantity session scan: forward request.Quantity. Service
            // coerces non-positive to 1 and distributes across matching lines.
            var result = await _service.ScanInSessionAsync(id, request.PlantBarcode, request.Quantity);
            if (result.Result == ScanSessionResult.Expired)
                return StatusCode(StatusCodes.Status410Gone, ApiResponse<ScanSessionScanResponse>.Ok(result));

            return Ok(ApiResponse<ScanSessionScanResponse>.Ok(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScanSessionScanResponse>.Fail(ex.Message));
        }
        catch (ValidationException ex)
        {
            return UnprocessableEntity(ApiResponse<ScanSessionScanResponse>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Closes a scan session. Subsequent scans return 410.
    /// </summary>
    [HttpPost("{id:guid}/close")]
    [ProducesResponseType(typeof(ApiResponse<ScanSessionResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 404)]
    public async Task<IActionResult> Close(Guid id)
    {
        try
        {
            var session = await _service.CloseAsync(id);
            return Ok(ApiResponse<ScanSessionResponse>.Ok(session));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Adds additional orders to a session. Gated off in v1; returns 400 unless enabled.
    /// </summary>
    [HttpPost("{id:guid}/expand")]
    [ProducesResponseType(typeof(ApiResponse<ScanSessionResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<object>), 400)]
    public async Task<IActionResult> Expand(Guid id, [FromBody] List<Guid> additionalOrderIds)
    {
        try
        {
            var session = await _service.ExpandAsync(id, additionalOrderIds ?? new List<Guid>());
            return Ok(ApiResponse<ScanSessionResponse>.Ok(session));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
        catch (NotImplementedException ex)
        {
            return BadRequest(ApiResponse<ScanSessionResponse>.Fail(ex.Message));
        }
    }
}
