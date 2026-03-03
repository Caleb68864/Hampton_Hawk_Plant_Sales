namespace HamptonHawksPlantSales.Core.Models;

public class ImportIssue : EventEntity
{
    public Guid ImportBatchId { get; set; }
    public int RowNumber { get; set; }
    public string IssueType { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? RawData { get; set; }

    public ImportBatch ImportBatch { get; set; } = null!;
}
