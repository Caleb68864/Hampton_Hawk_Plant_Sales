using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

/// <summary>
/// Imports data from CSV/Excel files (plants, inventory, orders).
/// </summary>
[ApiController]
[Route("api/import")]
public class ImportController : ControllerBase
{
    private readonly IImportService _importService;

    public ImportController(IImportService importService)
    {
        _importService = importService;
    }

    /// <summary>
    /// Imports plants from a CSV or Excel file.
    /// </summary>
    /// <param name="file">CSV or Excel file containing plant data.</param>
    /// <response code="200">Import result with row counts and any issues.</response>
    /// <response code="400">File is missing or empty.</response>
    [HttpPost("plants")]
    [ProducesResponseType(typeof(ApiResponse<ImportResultResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> ImportPlants(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<ImportResultResponse>.Fail("File is required."));

        using var stream = file.OpenReadStream();
        var result = await _importService.ImportAsync(ImportType.Plants, file.FileName, stream);
        return Ok(ApiResponse<ImportResultResponse>.Ok(result));
    }

    /// <summary>
    /// Imports inventory quantities from a CSV or Excel file.
    /// </summary>
    /// <param name="file">CSV or Excel file containing inventory data.</param>
    /// <response code="200">Import result with row counts and any issues.</response>
    /// <response code="400">File is missing or empty.</response>
    [HttpPost("inventory")]
    [ProducesResponseType(typeof(ApiResponse<ImportResultResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> ImportInventory(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<ImportResultResponse>.Fail("File is required."));

        using var stream = file.OpenReadStream();
        var result = await _importService.ImportAsync(ImportType.Inventory, file.FileName, stream);
        return Ok(ApiResponse<ImportResultResponse>.Ok(result));
    }

    /// <summary>
    /// Imports orders from a CSV or Excel file.
    /// </summary>
    /// <param name="file">CSV or Excel file containing order data.</param>
    /// <response code="200">Import result with row counts and any issues.</response>
    /// <response code="400">File is missing or empty.</response>
    [HttpPost("orders")]
    [ProducesResponseType(typeof(ApiResponse<ImportResultResponse>), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> ImportOrders(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<ImportResultResponse>.Fail("File is required."));

        using var stream = file.OpenReadStream();
        var result = await _importService.ImportAsync(ImportType.Orders, file.FileName, stream);
        return Ok(ApiResponse<ImportResultResponse>.Ok(result));
    }

    /// <summary>
    /// Lists import batches with pagination.
    /// </summary>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of import batches.</response>
    [HttpGet("batches")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ImportBatchResponse>>), 200)]
    public async Task<IActionResult> GetBatches(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _importService.GetBatchesAsync(paging);
        return Ok(ApiResponse<PagedResult<ImportBatchResponse>>.Ok(result));
    }

    /// <summary>
    /// Gets issues (warnings/errors) for a specific import batch.
    /// </summary>
    /// <param name="id">Import batch ID.</param>
    /// <param name="search">Filter issues by text.</param>
    /// <param name="page">Page number (1-based).</param>
    /// <param name="pageSize">Items per page.</param>
    /// <response code="200">Paged list of import issues.</response>
    [HttpGet("batches/{id:guid}/issues")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ImportIssueResponse>>), 200)]
    public async Task<IActionResult> GetBatchIssues(
        Guid id,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var paging = new PaginationParams { Page = page, PageSize = pageSize };
        var result = await _importService.GetBatchIssuesAsync(id, search, paging);
        return Ok(ApiResponse<PagedResult<ImportIssueResponse>>.Ok(result));
    }
}
