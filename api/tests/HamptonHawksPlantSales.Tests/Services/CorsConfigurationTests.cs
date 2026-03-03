using FluentAssertions;
using HamptonHawksPlantSales.Api.Configuration;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace HamptonHawksPlantSales.Tests.Services;

public class CorsConfigurationTests
{
    [Fact]
    public void ParseAllowedOrigins_SupportsCommaSeparatedOriginsFromConfiguration()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins"] = "https://allowed.example.com, https://second.example.com/"
            })
            .Build();

        var origins = CorsOriginParser.ParseAllowedOrigins(configuration);

        origins.Should().BeEquivalentTo("https://allowed.example.com", "https://second.example.com");
    }

    [Fact]
    public void CorsPolicy_AllowsKnownOrigin_AndBlocksUnknownOrigin()
    {
        var policy = new CorsPolicyBuilder()
            .WithOrigins("https://allowed.example.com")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .Build();

        var corsService = new CorsService(Options.Create(new CorsOptions()), NullLoggerFactory.Instance);

        var allowedContext = new DefaultHttpContext();
        allowedContext.Request.Headers.Origin = "https://allowed.example.com";

        var blockedContext = new DefaultHttpContext();
        blockedContext.Request.Headers.Origin = "https://blocked.example.com";

        var allowedResult = corsService.EvaluatePolicy(allowedContext, policy);
        var blockedResult = corsService.EvaluatePolicy(blockedContext, policy);

        allowedResult.IsOriginAllowed.Should().BeTrue();
        blockedResult.IsOriginAllowed.Should().BeFalse();
    }
}
