using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class ScanSession : BaseEntity
{
    public DateTimeOffset? ClosedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public string WorkstationName { get; set; } = string.Empty;
    public ScanSessionEntityKind EntityKind { get; set; }
    public Guid? EntityId { get; set; }

    public ICollection<ScanSessionMember> Members { get; set; } = new List<ScanSessionMember>();
}
