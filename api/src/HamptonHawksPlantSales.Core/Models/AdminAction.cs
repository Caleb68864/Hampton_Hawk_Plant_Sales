namespace HamptonHawksPlantSales.Core.Models;

public class AdminAction : EventEntity
{
    public string ActionType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Message { get; set; }
}
