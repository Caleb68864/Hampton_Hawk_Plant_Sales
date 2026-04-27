namespace HamptonHawksPlantSales.Core.Models;

public class ScanSessionMember : BaseEntity
{
    public Guid SessionId { get; set; }
    public Guid OrderId { get; set; }

    public ScanSession? Session { get; set; }
    public Order? Order { get; set; }
}
