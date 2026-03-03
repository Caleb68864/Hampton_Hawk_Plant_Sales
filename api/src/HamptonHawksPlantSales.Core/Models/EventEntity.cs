namespace HamptonHawksPlantSales.Core.Models;

/// <summary>
/// Base class for event/log entities that only have CreatedAt and DeletedAt (no UpdatedAt).
/// Used by FulfillmentEvent, ImportBatch, ImportIssue, InventoryAdjustment, AdminAction.
/// </summary>
public abstract class EventEntity
{
    public Guid Id { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}
