namespace HamptonHawksPlantSales.Core.DTOs;

public class ImportResultResponse
{
    public Guid BatchId { get; set; }
    public int TotalRows { get; set; }
    public int ImportedCount { get; set; }
    public int SkippedCount { get; set; }
    public int IssueCount { get; set; }
    public bool DryRun { get; set; }
}

public class ImportOptions
{
    public bool DryRun { get; set; }
    public bool UpsertPlantsBySku { get; set; } = true;
    public bool ResolveDuplicateOrderNumbers { get; set; }
}

public class ImportBatchResponse
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Filename { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ImportedCount { get; set; }
    public int SkippedCount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class ImportIssueResponse
{
    public Guid Id { get; set; }
    public int RowNumber { get; set; }
    public string IssueType { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Sku { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? RawData { get; set; }
}
