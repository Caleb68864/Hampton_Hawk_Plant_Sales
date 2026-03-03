namespace HamptonHawksPlantSales.Core.DTOs;

public class SettingsResponse
{
    public bool SaleClosed { get; set; }
    public DateTimeOffset? SaleClosedAt { get; set; }
}

public class UpdateSaleClosedRequest
{
    public bool SaleClosed { get; set; }
    public string? Reason { get; set; }
}
