using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IImportService
{
    Task<ImportResultResponse> ImportAsync(ImportType type, string filename, Stream fileStream, ImportOptions? options = null);
    Task<PagedResult<ImportBatchResponse>> GetBatchesAsync(PaginationParams paging);
    Task<PagedResult<ImportIssueResponse>> GetBatchIssuesAsync(Guid batchId, string? search, PaginationParams paging);
}
