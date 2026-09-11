using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using HamptonHawksPlantSales.Api.Configuration;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Auth;

public class LoginRateLimitIntegrationTests
{
    [Fact]
    public async Task Login_IsRateLimitedPerClient()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();
        var body = new { username = "nobody", password = "wrong-password" };

        for (var i = 0; i < RateLimitPolicies.LoginPermitLimit; i++)
        {
            var allowed = await client.PostAsJsonAsync("/api/auth/login", body);
            allowed.StatusCode.Should().Be(HttpStatusCode.OK, $"attempt {i + 1} is within the window budget");
        }

        var throttled = await client.PostAsJsonAsync("/api/auth/login", body);
        throttled.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        var envelope = await throttled.Content.ReadFromJsonAsync<ApiResponse<object>>();
        envelope!.Success.Should().BeFalse();
        envelope.Errors.Should().ContainSingle(e => e.Contains("Too many"));
    }
}
