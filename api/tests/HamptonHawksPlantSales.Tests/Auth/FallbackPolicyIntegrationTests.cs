using System.Net;
using FluentAssertions;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// The deny-by-default fallback policy must not break the probes and the
/// deliberately anonymous endpoints, and must challenge everything else.
/// </summary>
public class FallbackPolicyIntegrationTests
{
    [Fact]
    public async Task HealthProbes_RemainAnonymous()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();

        foreach (var path in new[] { "/health", "/api/health" })
        {
            var response = await client.GetAsync(path);
            response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized, path);
            response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden, path);
        }
    }

    [Fact]
    public async Task AllowAnonymousEndpoints_StillWorkWithoutASession()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();

        (await client.GetAsync("/api/version")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/api/reports/live-sale-kpi")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UnknownRoute_Is404NotAChallenge()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();

        (await client.GetAsync("/api/does-not-exist")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutSession_Is401()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();

        (await client.GetAsync("/api/orders")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
