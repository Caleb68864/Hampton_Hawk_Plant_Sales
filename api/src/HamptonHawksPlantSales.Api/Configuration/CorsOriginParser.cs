using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Api.Configuration;

public static class CorsOriginParser
{
    public static string[] ParseAllowedOrigins(IConfiguration configuration)
    {
        var section = configuration.GetSection("Cors:AllowedOrigins");
        var origins = new List<string>();

        if (!string.IsNullOrWhiteSpace(section.Value))
        {
            origins.AddRange(SplitOrigins(section.Value));
        }

        foreach (var child in section.GetChildren())
        {
            if (string.IsNullOrWhiteSpace(child.Value))
            {
                continue;
            }

            origins.AddRange(SplitOrigins(child.Value));
        }

        var normalizedOrigins = origins
            .Select(origin => origin.Trim().TrimEnd('/'))
            .Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (normalizedOrigins.Any(origin => origin == "*"))
        {
            throw new InvalidOperationException("Wildcard CORS origins are not allowed. Configure explicit origins in Cors:AllowedOrigins.");
        }

        return normalizedOrigins;
    }

    private static IEnumerable<string> SplitOrigins(string configuredOrigins)
    {
        return configuredOrigins
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}
