namespace HamptonHawksPlantSales.Core.Models;

public class Customer : BaseEntity
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string PickupCode { get; set; } = string.Empty;
    public string? Notes { get; set; }
}
