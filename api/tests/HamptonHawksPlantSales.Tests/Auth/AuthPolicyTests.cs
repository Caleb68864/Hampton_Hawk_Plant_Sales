using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace HamptonHawksPlantSales.Tests.Auth;

public class AuthPolicyTests
{
    private static IAuthorizationService BuildAuthorizationService(Action<AuthorizationOptions> configure)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorizationCore(configure);
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static System.Security.Claims.ClaimsPrincipal MakeUser(params string[] roles)
    {
        var claims = roles.Select(r => new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, r)).ToList();
        claims.Add(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "testuser"));
        var identity = new System.Security.Claims.ClaimsIdentity(claims, "TestAuth");
        return new System.Security.Claims.ClaimsPrincipal(identity);
    }

    private static void ConfigurePolicies(AuthorizationOptions options)
    {
        options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
        options.AddPolicy("PickupCapable", policy => policy.RequireRole("Admin", "Pickup"));
        options.AddPolicy("LookupCapable", policy => policy.RequireRole("Admin", "LookupPrint", "Pickup"));
        options.AddPolicy("POSCapable", policy => policy.RequireRole("Admin", "POS"));
        options.AddPolicy("ReportsCapable", policy => policy.RequireRole("Admin", "Reports"));
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("Pickup", false)]
    [InlineData("POS", false)]
    [InlineData("Reports", false)]
    [InlineData("LookupPrint", false)]
    public async Task AdminOnly_OnlyAdminSucceeds(string role, bool expected)
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var user = MakeUser(role);

        var result = await auth.AuthorizeAsync(user, null, "AdminOnly");

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("Pickup", true)]
    [InlineData("POS", false)]
    [InlineData("Reports", false)]
    [InlineData("LookupPrint", false)]
    public async Task PickupCapable_AdminAndPickupSucceed(string role, bool expected)
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var user = MakeUser(role);

        var result = await auth.AuthorizeAsync(user, null, "PickupCapable");

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("LookupPrint", true)]
    [InlineData("Pickup", true)]
    [InlineData("POS", false)]
    [InlineData("Reports", false)]
    public async Task LookupCapable_AdminLookupAndPickupSucceed(string role, bool expected)
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var user = MakeUser(role);

        var result = await auth.AuthorizeAsync(user, null, "LookupCapable");

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("POS", true)]
    [InlineData("Pickup", false)]
    [InlineData("LookupPrint", false)]
    [InlineData("Reports", false)]
    public async Task POSCapable_AdminAndPOSSucceed(string role, bool expected)
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var user = MakeUser(role);

        var result = await auth.AuthorizeAsync(user, null, "POSCapable");

        Assert.Equal(expected, result.Succeeded);
    }

    [Theory]
    [InlineData("Admin", true)]
    [InlineData("Reports", true)]
    [InlineData("POS", false)]
    [InlineData("Pickup", false)]
    [InlineData("LookupPrint", false)]
    public async Task ReportsCapable_AdminAndReportsSucceed(string role, bool expected)
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var user = MakeUser(role);

        var result = await auth.AuthorizeAsync(user, null, "ReportsCapable");

        Assert.Equal(expected, result.Succeeded);
    }

    [Fact]
    public async Task Unauthenticated_FailsAllPolicies()
    {
        var auth = BuildAuthorizationService(ConfigurePolicies);
        var anonymous = new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity());

        foreach (var policy in new[] { "AdminOnly", "PickupCapable", "LookupCapable", "POSCapable", "ReportsCapable" })
        {
            var result = await auth.AuthorizeAsync(anonymous, null, policy);
            Assert.False(result.Succeeded, $"Expected policy '{policy}' to fail for unauthenticated user");
        }
    }
}
