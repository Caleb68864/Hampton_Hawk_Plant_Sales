using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Provides access to admin action audit records.
/// </summary>
[ApiController]
[Route("api/admin-actions")]
public class AdminActionsController : ControllerBase
{
    private readonly IAdminService _adminService;

    public AdminActionsController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    /// <summary>
    /// Validates the supplied admin PIN and returns a verification timestamp.
    /// </summary>
    /// <response code="200">PIN is valid.</response>
    /// <response code="403">Missing or invalid admin PIN.</response>
    [HttpGet("verify-pin")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<AdminPinValidationResponse>), 200)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> VerifyPin()
    {
        var result = await _adminService.ValidatePinAsync();
        return Ok(ApiResponse<AdminPinValidationResponse>.Ok(result));
    }

    /// <summary>
    /// Returns a list of admin action audit records, optionally filtered. Requires admin PIN.
    /// </summary>
    /// <param name="orderId">Filter by entity ID (e.g. order ID).</param>
    /// <param name="entityType">Filter by entity type.</param>
    /// <param name="actionType">Filter by action type.</param>
    /// <response code="200">List of admin actions ordered by CreatedAt descending.</response>
    /// <response code="403">Missing or invalid admin PIN.</response>
    [HttpGet]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<List<AdminActionResponse>>), 200)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? orderId,
        [FromQuery] string? entityType,
        [FromQuery] string? actionType)
    {
        var result = await _adminService.GetActionsAsync(orderId, entityType, actionType);
        return Ok(ApiResponse<List<AdminActionResponse>>.Ok(result));
    }
}
