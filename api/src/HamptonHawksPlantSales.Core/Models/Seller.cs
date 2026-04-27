namespace HamptonHawksPlantSales.Core.Models;

public class Seller : BaseEntity
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string PicklistBarcode { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? Teacher { get; set; }
    public string? Notes { get; set; }
}
