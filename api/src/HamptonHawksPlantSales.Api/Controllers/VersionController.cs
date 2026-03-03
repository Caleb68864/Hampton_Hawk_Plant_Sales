using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Returns the current API version.
/// </summary>
[ApiController]
[Route("api")]
public class VersionController : ControllerBase
{
    /// <summary>
    /// Gets the running API version string.
    /// </summary>
    /// <response code="200">Version object.</response>
    [HttpGet("version")]
    [ProducesResponseType(typeof(ApiResponse<object>), 200)]
    public IActionResult GetVersion()
    {
        return Ok(ApiResponse<object>.Ok(new { version = "1.0.0" }));
    }
}
