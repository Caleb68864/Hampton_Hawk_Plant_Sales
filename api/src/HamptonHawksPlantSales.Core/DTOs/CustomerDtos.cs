namespace HamptonHawksPlantSales.Core.DTOs;

public class CreateCustomerRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? PickupCode { get; set; }
    public string? Notes { get; set; }
}

public class UpdateCustomerRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? PickupCode { get; set; }
    public string? Notes { get; set; }
}

public class CustomerResponse
{
    public Guid Id { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string PickupCode { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}
