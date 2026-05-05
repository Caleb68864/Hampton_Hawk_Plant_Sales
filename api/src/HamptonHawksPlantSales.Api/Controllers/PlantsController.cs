using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages the plant catalog (varieties available for sale).
/// </summary>
[ApiController]
[Route("api/plants")]
[Authorize(Policy = "LookupCapable")]
public class PlantsController : ControllerBase
{
    private readonly IPlantService _plantService;
    private readonly IValidator<CreatePlantRequest> _createValidator;
    private readonly IValidator<UpdatePlantRequest> _updateValidator;

    public PlantsController(
        IPlantService plantService,
        IValidator<CreatePlantRequest> createValidator,
        IValidator<UpdatePlantRequest> updateValidator)
    {
        _plantService = plantService;
        _createValidator = createValidator;
        _updateValidator = updateValidator;
    }

    /// <summary>
    /// Lists plants with optional search, active-only filter, and pagination.
    /// </summary>
    /// <param name="search">Free-text search on name or SKU.</param>
    /// <param name="activeOnly">When true, returns only active plants.</param>
    /// <param name="includeDeleted">When true, includes soft-deleted plants.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of plants.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<PlantResponse>>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool? activeOnly,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _plantService.GetAllAsync(search, activeOnly, includeDeleted, paging);
        return Ok(ApiResponse<PagedResult<PlantResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets a single plant by its unique identifier.
    /// </summary>
    /// <param name="id">Plant ID.</param>
    /// <response code="200">The plant.</response>
    /// <response code="404">Plant not found.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PlantResponse>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _plantService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<PlantResponse>.Fail("Plant not found."));
        return Ok(ApiResponse<PlantResponse>.Ok(result));
    }

    /// <summary>
    /// Creates a new plant in the catalog.
    /// </summary>
    /// <param name="request">Plant creation payload.</param>
    /// <response code="200">The created plant.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<PlantResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreatePlantRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<PlantResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _plantService.CreateAsync(request);
        return Ok(ApiResponse<PlantResponse>.Ok(result));
    }

    /// <summary>
    /// Updates an existing plant.
    /// </summary>
    /// <param name="id">Plant ID.</param>
    /// <param name="request">Updated plant data.</param>
    /// <response code="200">The updated plant.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<PlantResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePlantRequest request)
    {
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<PlantResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _plantService.UpdateAsync(id, request);
        return Ok(ApiResponse<PlantResponse>.Ok(result));
    }

    /// <summary>
    /// Soft-deletes a plant from the catalog.
    /// </summary>
    /// <param name="id">Plant ID.</param>
    /// <response code="200">Deletion succeeded.</response>
    /// <response code="404">Plant not found.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _plantService.DeleteAsync(id);
        if (!result)
            return NotFound(ApiResponse<bool>.Fail("Plant not found."));
        return Ok(ApiResponse<bool>.Ok(true));
    }
}
