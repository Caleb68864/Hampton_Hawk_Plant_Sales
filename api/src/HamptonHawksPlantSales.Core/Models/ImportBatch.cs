using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class ImportBatch : EventEntity, IUserAttributed
{
    /// <summary>Signed-in account that caused this row (stamped on insert).</summary>
    public Guid? UserId { get; set; }
    public ImportType Type { get; set; }
    public string Filename { get; set; } = string.Empty;
    public int TotalRows { get; set; }
    public int ImportedCount { get; set; }
    public int SkippedCount { get; set; }
    public string? SourceFormat { get; set; }

    public ICollection<ImportIssue> Issues { get; set; } = new List<ImportIssue>();
}
