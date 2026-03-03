using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Handles walk-up (day-of) orders with inventory protection.
/// </summary>
[ApiController]
[Route("api/walkup")]
public class WalkUpController : ControllerBase
{
    private readonly IWalkUpService _walkUpService;
    private readonly IInventoryProtectionService _protectionService;

    public WalkUpController(IWalkUpService walkUpService, IInventoryProtectionService protectionService)
    {
        _walkUpService = walkUpService;
        _protectionService = protectionService;
    }

    /// <summary>
    /// Creates a new walk-up order for a day-of customer.
    /// </summary>
    /// <param name="request">Walk-up order details.</param>
    /// <response code="200">The created walk-up order.</response>
    [HttpPost("orders")]
    [ProducesResponseType(typeof(ApiResponse<OrderResponse>), 200)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateWalkUpOrderRequest request)
    {
        var result = await _walkUpService.CreateWalkUpOrderAsync(request);
        return Ok(ApiResponse<OrderResponse>.Ok(result));
    }

    /// <summary>
    /// Adds a line item to an existing walk-up order. Admin PIN may be required to exceed available stock.
    /// </summary>
    /// <param name="id">Walk-up order ID.</param>
    /// <param name="request">Line item details.</param>
    /// <response code="200">The created line item.</response>
    [HttpPost("orders/{id:guid}/lines")]
    [ProducesResponseType(typeof(ApiResponse<OrderLineResponse>), 200)]
    public async Task<IActionResult> AddLine(Guid id, [FromBody] AddWalkUpLineRequest request)
    {
        var pin = Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = Request.Headers["X-Admin-Reason"].FirstOrDefault();

        var result = await _walkUpService.AddWalkUpLineAsync(id, request, pin, reason);
        return Ok(ApiResponse<OrderLineResponse>.Ok(result));
    }

    /// <summary>
    /// Updates a line item on a walk-up order. Admin PIN may be required to exceed available stock.
    /// </summary>
    /// <param name="id">Walk-up order ID.</param>
    /// <param name="lineId">Line item ID.</param>
    /// <param name="request">Updated line item data.</param>
    /// <response code="200">The updated line item.</response>
    [HttpPut("orders/{id:guid}/lines/{lineId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OrderLineResponse>), 200)]
    public async Task<IActionResult> UpdateLine(Guid id, Guid lineId, [FromBody] UpdateWalkUpLineRequest request)
    {
        var pin = Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = Request.Headers["X-Admin-Reason"].FirstOrDefault();

        var result = await _walkUpService.UpdateWalkUpLineAsync(id, lineId, request, pin, reason);
        return Ok(ApiResponse<OrderLineResponse>.Ok(result));
    }

    /// <summary>
    /// Gets the available walk-up quantity for plants. Returns all active plants when no plantCatalogId is specified.
    /// </summary>
    /// <param name="plantCatalogId">Optional plant catalog ID. If omitted, returns all active plants.</param>
    /// <response code="200">Available walk-up quantity or list of all plant availabilities.</response>
    [HttpGet("availability")]
    [ProducesResponseType(typeof(ApiResponse<WalkUpAvailabilityResponse>), 200)]
    [ProducesResponseType(typeof(ApiResponse<List<WalkUpAvailabilityResponse>>), 200)]
    public async Task<IActionResult> GetAvailability([FromQuery] Guid? plantCatalogId)
    {
        if (plantCatalogId.HasValue)
        {
            var all = await _protectionService.GetAllAvailabilityAsync();
            var match = all.FirstOrDefault(a => a.PlantCatalogId == plantCatalogId.Value);

            if (match == null)
            {
                // Plant not found or not active; return zeroed response
                match = new WalkUpAvailabilityResponse
                {
                    PlantCatalogId = plantCatalogId.Value,
                    PlantName = string.Empty,
                    PlantSku = string.Empty,
                    OnHandQty = 0,
                    PreorderRemaining = 0,
                    AvailableForWalkup = 0
                };
            }

            return Ok(ApiResponse<WalkUpAvailabilityResponse>.Ok(match));
        }

        var responses = await _protectionService.GetAllAvailabilityAsync();
        return Ok(ApiResponse<List<WalkUpAvailabilityResponse>>.Ok(responses));
    }
}
