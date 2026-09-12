using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HamptonHawksPlantSales.Tests.Helpers;

/// <summary>
/// Boots the real Program.cs pipeline with the real cookie authentication handler
/// left in place, so a test can log in over HTTP and inspect the actual
/// <c>Set-Cookie</c> header the deployed API would send.
///
/// <para>
/// <see cref="TestApiFactory"/> deliberately replaces the authentication scheme with
/// a header-driven stub, which makes it useless for anything about the session
/// cookie itself. This factory keeps cookie auth and instead swaps only the
/// database, and it runs as <c>Production</c> — the environment
/// <c>docker-compose.yml</c> sets — because the cookie's <c>Secure</c> policy is
/// chosen from the environment.
/// </para>
/// </summary>
public class RealCookieAuthApiFactory : WebApplicationFactory<Program>
{
    public const string AdminUsername = "cookie-test-admin";
    public const string AdminPassword = "cookie-test-password";

    private readonly IReadOnlyDictionary<string, string?> _settings;

    /// <param name="settings">
    /// Extra configuration entries, in <see cref="Microsoft.Extensions.Configuration.IConfiguration"/>
    /// colon form (e.g. <c>Session:AllowInsecureCookieOverHttp</c>). Passing none
    /// gives the stock deployed configuration.
    /// </param>
    public RealCookieAuthApiFactory(IReadOnlyDictionary<string, string?>? settings = null)
    {
        _settings = settings ?? new Dictionary<string, string?>();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("ConnectionStrings:Default", "Host=localhost;Database=unused;Username=unused;Password=unused");

        // AuthBootstrapService seeds this account at startup, giving the test a
        // real credential to log in with instead of a forged principal.
        builder.UseSetting("Bootstrap:AdminUsername", AdminUsername);
        builder.UseSetting("Bootstrap:AdminPassword", AdminPassword);

        foreach (var (key, value) in _settings)
            builder.UseSetting(key, value);

        builder.ConfigureServices(services =>
        {
            var efDescriptors = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                         || d.ServiceType == typeof(DbContextOptions)
                         || d.ServiceType == typeof(AppDbContext)
                         || (d.ServiceType.FullName?.Contains("EntityFrameworkCore") == true)
                         || (d.ServiceType.FullName?.Contains("Npgsql") == true))
                .ToList();
            foreach (var d in efDescriptors)
                services.Remove(d);

            var dbName = $"cookie-tests-db-{Guid.NewGuid()}";
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(dbName));
        });
    }
}
