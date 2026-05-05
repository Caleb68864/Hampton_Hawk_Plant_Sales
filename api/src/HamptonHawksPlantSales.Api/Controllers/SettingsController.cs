using FluentValidation;
using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages global application settings including the SaleClosed flag.
/// </summary>
[ApiController]
[Route("api/settings")]
[Authorize(Policy = "AdminOnly")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;
    private readonly IValidator<UpdateScannerTuningRequest> _scannerTuningValidator;

    public SettingsController(
        ISettingsService settingsService,
        IValidator<UpdateScannerTuningRequest> scannerTuningValidator)
    {
        _settingsService = settingsService;
        _scannerTuningValidator = scannerTuningValidator;
    }

    /// <summary>
    /// Gets the current application settings.
    /// </summary>
    /// <response code="200">Current settings including SaleClosed state.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<SettingsResponse>), 200)]
    public async Task<IActionResult> GetSettings()
    {
        var result = await _settingsService.GetSettingsAsync();
        return Ok(ApiResponse<SettingsResponse>.Ok(result));
    }

    /// <summary>
    /// Toggles the SaleClosed flag. When closed, new orders and modifications are blocked. Requires admin PIN.
    /// </summary>
    /// <param name="request">SaleClosed state and reason.</param>
    /// <response code="200">Updated settings.</response>
    [HttpPut("sale-closed")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<SettingsResponse>), 200)]
    public async Task<IActionResult> UpdateSaleClosed([FromBody] UpdateSaleClosedRequest request)
    {
        var result = await _settingsService.ToggleSaleClosedAsync(request.SaleClosed, request.Reason);
        return Ok(ApiResponse<SettingsResponse>.Ok(result));
    }

    /// <summary>
    /// Updates scanner tuning settings. Requires admin PIN.
    /// </summary>
    /// <param name="request">Scanner tuning settings to update.</param>
    /// <response code="200">Updated settings.</response>
    /// <response code="400">Validation errors.</response>
    /// <response code="403">Admin PIN required.</response>
    [HttpPut("scanner-tuning")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<SettingsResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<SettingsResponse>), 400)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> UpdateScannerTuning([FromBody] UpdateScannerTuningRequest request)
    {
        var validation = await _scannerTuningValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            return BadRequest(ApiResponse<SettingsResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));
        }

        var reason = HttpContext.Items["AdminReason"] as string;
        var result = await _settingsService.UpdateScannerTuningAsync(request, reason);
        return Ok(ApiResponse<SettingsResponse>.Ok(result));
    }
}
