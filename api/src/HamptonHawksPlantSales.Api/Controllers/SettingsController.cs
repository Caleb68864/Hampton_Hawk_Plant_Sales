using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages global application settings including the SaleClosed flag.
/// </summary>
[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public SettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
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
}
