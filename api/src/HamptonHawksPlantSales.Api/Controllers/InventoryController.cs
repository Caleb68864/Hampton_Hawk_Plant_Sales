using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages plant inventory quantities.
/// </summary>
[ApiController]
[Route("api/inventory")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;
    private readonly IValidator<UpdateInventoryRequest> _updateValidator;
    private readonly IValidator<AdjustInventoryRequest> _adjustValidator;

    public InventoryController(
        IInventoryService inventoryService,
        IValidator<UpdateInventoryRequest> updateValidator,
        IValidator<AdjustInventoryRequest> adjustValidator)
    {
        _inventoryService = inventoryService;
        _updateValidator = updateValidator;
        _adjustValidator = adjustValidator;
    }

    /// <summary>
    /// Lists inventory with optional search and pagination.
    /// </summary>
    /// <param name="search">Free-text search on plant name or SKU.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged inventory list.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<InventoryResponse>>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _inventoryService.GetAllAsync(search, paging);
        return Ok(ApiResponse<PagedResult<InventoryResponse>>.Ok(result));
    }

    /// <summary>
    /// Sets the absolute inventory quantity for a plant.
    /// </summary>
    /// <param name="plantId">Plant catalog ID.</param>
    /// <param name="request">New inventory quantity.</param>
    /// <response code="200">Updated inventory record.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPut("{plantId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<InventoryResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> SetInventory(Guid plantId, [FromBody] UpdateInventoryRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<InventoryResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _inventoryService.SetInventoryAsync(plantId, request);
        return Ok(ApiResponse<InventoryResponse>.Ok(result));
    }

    /// <summary>
    /// Adjusts inventory by a relative delta (positive or negative).
    /// </summary>
    /// <param name="request">Adjustment details including plant ID and delta.</param>
    /// <response code="200">Updated inventory record.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPost("adjust")]
    [ProducesResponseType(typeof(ApiResponse<InventoryResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> AdjustInventory([FromBody] AdjustInventoryRequest request)
    {
        var validation = await _adjustValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<InventoryResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _inventoryService.AdjustInventoryAsync(request);
        return Ok(ApiResponse<InventoryResponse>.Ok(result));
    }
}
