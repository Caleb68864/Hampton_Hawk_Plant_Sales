using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages customers (buyers who place orders).
/// </summary>
[ApiController]
[Route("api/customers")]
[Authorize(Policy = "LookupCapable")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _customerService;
    private readonly IValidator<CreateCustomerRequest> _createValidator;

    public CustomersController(ICustomerService customerService, IValidator<CreateCustomerRequest> createValidator)
    {
        _customerService = customerService;
        _createValidator = createValidator;
    }

    /// <summary>
    /// Lists customers with optional search and pagination.
    /// </summary>
    /// <param name="search">Free-text search on name, email, or pickup code.</param>
    /// <param name="includeDeleted">When true, includes soft-deleted customers.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of customers.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<CustomerResponse>>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _customerService.GetAllAsync(search, includeDeleted, paging);
        return Ok(ApiResponse<PagedResult<CustomerResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets a single customer by ID.
    /// </summary>
    /// <param name="id">Customer ID.</param>
    /// <response code="200">The customer.</response>
    /// <response code="404">Customer not found.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerResponse>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _customerService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<CustomerResponse>.Fail("Customer not found."));
        return Ok(ApiResponse<CustomerResponse>.Ok(result));
    }

    /// <summary>
    /// Creates a new customer.
    /// </summary>
    /// <param name="request">Customer creation payload.</param>
    /// <response code="200">The created customer.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<CustomerResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<CustomerResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _customerService.CreateAsync(request);
        return Ok(ApiResponse<CustomerResponse>.Ok(result));
    }

    /// <summary>
    /// Updates an existing customer.
    /// </summary>
    /// <param name="id">Customer ID.</param>
    /// <param name="request">Updated customer data.</param>
    /// <response code="200">The updated customer.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<CustomerResponse>), 200)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        var result = await _customerService.UpdateAsync(id, request);
        return Ok(ApiResponse<CustomerResponse>.Ok(result));
    }

    /// <summary>
    /// Soft-deletes a customer.
    /// </summary>
    /// <param name="id">Customer ID.</param>
    /// <response code="200">Deletion succeeded.</response>
    /// <response code="404">Customer not found.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _customerService.DeleteAsync(id);
        if (!result)
            return NotFound(ApiResponse<bool>.Fail("Customer not found."));
        return Ok(ApiResponse<bool>.Ok(true));
    }
}
