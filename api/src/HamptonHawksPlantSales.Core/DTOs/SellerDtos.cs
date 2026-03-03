namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateSellerRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? Teacher { get; set; }
    public string? Notes { get; set; }
}

public class UpdateSellerRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? Teacher { get; set; }
    public string? Notes { get; set; }
}

public class SellerResponse
{
    public Guid Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Grade { get; set; }
    public string? Teacher { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}
