using System.Security.Claims;
using System.Text.Encodings.Web;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HamptonHawksPlantSales.Tests.Helpers;

/// <summary>
/// Boots the real Program.cs pipeline against an InMemory database, with a "Test"
/// authentication scheme that signs in an Admin whenever an Authorization header
/// is present and yields no result otherwise.
/// </summary>
public sealed class TestApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", "Host=localhost;Database=unused;Username=unused;Password=unused");

        builder.ConfigureServices(services =>
        {
            // Remove ALL EF Core and Npgsql services to avoid dual-provider conflict
            var efDescriptors = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                         || d.ServiceType == typeof(DbContextOptions)
                         || d.ServiceType == typeof(AppDbContext)
                         || (d.ServiceType.FullName?.Contains("EntityFrameworkCore") == true)
                         || (d.ServiceType.FullName?.Contains("Npgsql") == true))
                .ToList();
            foreach (var d in efDescriptors)
                services.Remove(d);

            var dbName = $"api-tests-db-{Guid.NewGuid()}";
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(dbName));

            services.AddAuthentication("Test")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
        });
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder) { }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.ContainsKey("Authorization"))
                return Task.FromResult(AuthenticateResult.NoResult());

            var identity = new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.Name, "test-admin"), new Claim(ClaimTypes.Role, "Admin") }, "Test");
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), "Test")));
        }
    }
}
