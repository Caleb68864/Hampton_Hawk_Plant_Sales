using FluentValidation;
using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Manages customer orders and their line items.
/// </summary>
[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly IValidator<CreateOrderRequest> _createValidator;

    public OrdersController(IOrderService orderService, IValidator<CreateOrderRequest> createValidator)
    {
        _orderService = orderService;
        _createValidator = createValidator;
    }

    /// <summary>
    /// Lists orders with optional filters and pagination.
    /// </summary>
    /// <param name="search">Free-text search on order number or customer name.</param>
    /// <param name="status">Filter by order status.</param>
    /// <param name="isWalkUp">Filter walk-up vs pre-orders.</param>
    /// <param name="sellerId">Filter by seller ID.</param>
    /// <param name="customerId">Filter by customer ID.</param>
    /// <param name="includeDeleted">When true, includes soft-deleted orders.</param>
    /// <param name="includeDraft">When true, includes Draft (in-progress walk-up) orders. Default false.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of orders.</response>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<OrderResponse>>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] OrderStatus? status,
        [FromQuery] bool? isWalkUp,
        [FromQuery] Guid? sellerId,
        [FromQuery] Guid? customerId,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] bool includeDraft = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _orderService.GetAllAsync(search, status, isWalkUp, sellerId, customerId, includeDeleted, paging, includeDraft);
        return Ok(ApiResponse<PagedResult<OrderResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets a single order by ID, including its line items.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">The order with lines.</response>
    /// <response code="404">Order not found.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _orderService.GetByIdAsync(id);
        if (result == null)
            return NotFound(ApiResponse<OrderResponse>.Fail("Order not found."));
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Creates a new order with line items.
    /// </summary>
    /// <param name="request">Order creation payload including lines.</param>
    /// <response code="200">The created order.</response>
    /// <response code="400">Validation errors.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateOrderRequest request)
    {
        var validation = await _createValidator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<OrderResponse>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var result = await _orderService.CreateAsync(request);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Updates an existing order's metadata (status, seller, etc.).
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <param name="request">Updated order data.</param>
    /// <response code="200">The updated order.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrderRequest request)
    {
        var result = await _orderService.UpdateAsync(id, request);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Soft-deletes an order.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <response code="200">Deletion succeeded.</response>
    /// <response code="404">Order not found.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _orderService.DeleteAsync(id);
        if (!result)
            return NotFound(ApiResponse<bool>.Fail("Order not found."));
        return Ok(ApiResponse<bool>.Ok(true));
    }

    /// <summary>
    /// Hard-deletes ALL orders, order lines, and fulfillment events. Admin PIN required.
    /// Used to wipe the orders table before a fresh import.
    /// </summary>
    [HttpDelete("all")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<int>), 200)]
    public async Task<IActionResult> DeleteAll()
    {
        var count = await _orderService.DeleteAllOrdersAsync();
        return Ok(ApiResponse<int>.Ok(count));
    }

    /// <summary>
    /// Regenerates the Barcode column for every existing order from its OrderNumber. Admin PIN required.
    /// </summary>
    [HttpPost("regenerate-barcodes")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<int>), 200)]
    public async Task<IActionResult> RegenerateBarcodes()
    {
        var count = await _orderService.RegenerateAllBarcodesAsync();
        return Ok(ApiResponse<int>.Ok(count));
    }

    /// <summary>
    /// Adds a line item to an existing order. For walk-up orders, inventory protection is enforced.
    /// Provide X-Admin-Pin and X-Admin-Reason headers to override inventory limits (sets hasIssue=true).
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <param name="request">Line item details (plant, quantity).</param>
    /// <response code="200">The created line item.</response>
    /// <response code="400">Insufficient inventory for walk-up order.</response>
    [HttpPost("{id:guid}/lines")]
    [ProducesResponseType(typeof(ApiResponse<OrderLineResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> AddLine(Guid id, [FromBody] CreateOrderLineRequest request)
    {
        var pin = Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = Request.Headers["X-Admin-Reason"].FirstOrDefault();

        var result = await _orderService.AddLineAsync(id, request, pin, reason);
        return Ok(ApiResponse<OrderLineResponse>.Ok(result));
    }

    /// <summary>
    /// Updates an existing order line item.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <param name="lineId">Line item ID.</param>
    /// <param name="request">Updated line item data.</param>
    /// <response code="200">The updated line item.</response>
    [HttpPut("{id:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderLineResponse>), 200)]
    public async Task<IActionResult> UpdateLine(Guid id, Guid lineId, [FromBody] UpdateOrderLineRequest request)
    {
        var result = await _orderService.UpdateLineAsync(id, lineId, request);
        return Ok(ApiResponse<OrderLineResponse>.Ok(result));
    }

    /// <summary>
    /// Removes a line item from an order.
    /// </summary>
    /// <param name="id">Order ID.</param>
    /// <param name="lineId">Line item ID.</param>
    /// <response code="200">Deletion succeeded.</response>
    /// <response code="404">Line item not found.</response>
    [HttpDelete("{id:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteLine(Guid id, Guid lineId)
    {
        var result = await _orderService.DeleteLineAsync(id, lineId);
        if (!result)
            return NotFound(ApiResponse<bool>.Fail("Order line not found."));
        return Ok(ApiResponse<bool>.Ok(true));
    }

    /// <summary>
    /// Bulk-completes multiple orders at once. Only fully fulfilled orders will be completed.
    /// </summary>
    /// <param name="request">List of order IDs to complete.</param>
    /// <param name="validator">FluentValidation validator.</param>
    /// <response code="200">Bulk operation result with per-order outcomes.</response>
    /// <response code="400">Validation errors (e.g., exceeds 500 cap).</response>
    /// <response code="403">Admin PIN required.</response>
    [HttpPost("bulk-complete")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<BulkOperationResult>), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> BulkComplete(
        [FromBody] BulkCompleteOrdersRequest request,
        [FromServices] IValidator<BulkCompleteOrdersRequest> validator)
    {
        var validation = await validator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<BulkOperationResult>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var adminReason = HttpContext.Items["AdminReason"] as string;
        var result = await _orderService.BulkCompleteAsync(request, adminReason);
        return Ok(ApiResponse<BulkOperationResult>.Ok(result));
    }

    /// <summary>
    /// Bulk sets the status on multiple orders at once.
    /// </summary>
    /// <param name="request">List of order IDs and target status.</param>
    /// <param name="validator">FluentValidation validator.</param>
    /// <response code="200">Bulk operation result with per-order outcomes.</response>
    /// <response code="400">Validation errors (e.g., exceeds 500 cap).</response>
    /// <response code="403">Admin PIN required.</response>
    [HttpPost("bulk-status")]
    [RequiresAdminPin]
    [ProducesResponseType(typeof(ApiResponse<BulkOperationResult>), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(403)]
    public async Task<IActionResult> BulkSetStatus(
        [FromBody] BulkSetOrderStatusRequest request,
        [FromServices] IValidator<BulkSetOrderStatusRequest> validator)
    {
        var validation = await validator.ValidateAsync(request);
        if (!validation.IsValid)
            return BadRequest(ApiResponse<BulkOperationResult>.Fail(
                validation.Errors.Select(e => e.ErrorMessage).ToList()));

        var adminReason = HttpContext.Items["AdminReason"] as string;
        var result = await _orderService.BulkSetStatusAsync(request, adminReason);
        return Ok(ApiResponse<BulkOperationResult>.Ok(result));
    }
}
