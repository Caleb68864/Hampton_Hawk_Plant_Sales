namespace HamptonHawksPlantSales.Core.Models;

public class AppSettings : BaseEntity
{
    public bool SaleClosed { get; set; }
    public DateTimeOffset? SaleClosedAt { get; set; }
}
