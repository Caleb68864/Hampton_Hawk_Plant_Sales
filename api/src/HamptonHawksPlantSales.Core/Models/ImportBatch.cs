using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class ImportBatch : EventEntity
{
    public ImportType Type { get; set; }
    public string Filename { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ImportedCount { get; set; }
    public int SkippedCount { get; set; }
    public string? SourceFormat { get; set; }

    public ICollection<ImportIssue> Issues { get; set; } = new List<ImportIssue>();
}
