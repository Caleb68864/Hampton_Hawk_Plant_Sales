using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages sellers (students who sell plants).
/// </summary>
[ApiController]
[Route("api/sellers")]
[Authorize(Policy = "LookupCapable")]
public class SellersController : ControllerBase
{
    private readonly ISellerService _sellerService;
    private readonly IValidator<CreateSellerRequest> _createValidator;

    public SellersController(ISellerService sellerService, IValidator<CreateSellerRequest> createValidator)
    {
        _sellerService = sellerService;
        _createValidator = createValidator;
    }

    /// <summary>
    /// Lists sellers with optional search and pagination.
    /// </summary>
    /// <param name="search">Free-text search on name.</param>
    /// <param name="includeDeleted">When true, includes soft-deleted sellers.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of sellers.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<SellerResponse>>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _sellerService.GetAllAsync(search, includeDeleted, paging);
        return Ok(ApiResponse<PagedResult<SellerResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets a single seller by ID.
    /// </summary>
    /// <param name="id">Seller ID.</param>
    /// <response code="200">The seller.</response>
    /// <response code="404">Seller not found.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SellerResponse>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _sellerService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<SellerResponse>.Fail("Seller not found."));
        return Ok(ApiResponse<SellerResponse>.Ok(result));
    }

    /// <summary>
    /// Creates a new seller.
    /// </summary>
    /// <param name="request">Seller creation payload.</param>
    /// <response code="200">The created seller.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SellerResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateSellerRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<SellerResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _sellerService.CreateAsync(request);
        return Ok(ApiResponse<SellerResponse>.Ok(result));
    }

    /// <summary>
    /// Updates an existing seller.
    /// </summary>
    /// <param name="id">Seller ID.</param>
    /// <param name="request">Updated seller data.</param>
    /// <response code="200">The updated seller.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SellerResponse>), 200)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSellerRequest request)
    {
        var result = await _sellerService.UpdateAsync(id, request);
        return Ok(ApiResponse<SellerResponse>.Ok(result));
    }

    /// <summary>
    /// Soft-deletes a seller.
    /// </summary>
    /// <param name="id">Seller ID.</param>
    /// <response code="200">Deletion succeeded.</response>
    /// <response code="404">Seller not found.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _sellerService.DeleteAsync(id);
        if (!result)
            return NotFound(ApiResponse<bool>.Fail("Seller not found."));
        return Ok(ApiResponse<bool>.Ok(true));
    }
}
