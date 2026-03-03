namespace HamptonHawksPlantSales.Core.DTOs;

public class AdminActionResponse
{
    public Guid Id { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Message { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
