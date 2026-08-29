namespace HamptonHawksPlantSales.Api.Configuration;

/// <summary>Names of the rate-limiting policies registered in Program.cs.</summary>
public static class RateLimitPolicies
{
    /// <summary>Per-client fixed window on POST /api/auth/login.</summary>
    public const string Login = "login";

    public const int LoginPermitLimit = 10;
    public static readonly TimeSpan LoginWindow = TimeSpan.FromMinutes(1);
}
