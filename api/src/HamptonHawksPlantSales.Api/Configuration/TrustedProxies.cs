using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;

// ForwardedHeadersOptions.KnownNetworks is typed on the ASP.NET Core IPNetwork, which
// collides by name with System.Net.IPNetwork under `using System.Net`.
using ProxyNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace HamptonHawksPlantSales.Api.Configuration;

/// <summary>
/// Decides whether <c>X-Forwarded-For</c> and <c>X-Forwarded-Proto</c> are read, and
/// from whom.
///
/// <para>
/// Without this the API sees the proxy's own hop: <c>Request.Scheme</c> is the scheme
/// of the last leg (plain http from an nginx that already terminated TLS), and the
/// login rate limiter and <c>AdminPinActionFilter</c> partition every client in the
/// building onto the proxy's single address.
/// </para>
///
/// <para>
/// <c>UseForwardedHeaders</c> with nothing configured is worse than not calling it:
/// <c>ForwardedHeadersMiddleware</c> only consults its trust list when
/// <c>KnownProxies</c> or <c>KnownNetworks</c> is non-empty, so an options object with
/// both cleared honours <c>X-Forwarded-*</c> from anybody. On this LAN the API's port
/// 8080 is published to <c>0.0.0.0</c>, so "anybody" includes every phone at the sale:
/// one could claim <c>X-Forwarded-Proto: https</c> and, with
/// <c>Session__AllowInsecureCookieOverHttp</c> on, change the cookie policy it is
/// served, or invent an <c>X-Forwarded-For</c> and get a fresh rate-limit budget and a
/// forged client address in the logs.
/// </para>
///
/// <para>
/// So trust is opt-in and comes from configuration. Name the proxy and only the proxy.
/// Name nobody — the shipped default — and the middleware is never added at all, which
/// is the one arrangement that cannot be talked into anything.
/// </para>
/// </summary>
public static class TrustedProxies
{
    /// <summary>
    /// Comma-separated proxy addresses. As an environment variable:
    /// <c>ForwardedHeaders__KnownProxies=172.18.0.4</c>.
    /// </summary>
    public const string KnownProxiesKey = "ForwardedHeaders:KnownProxies";

    /// <summary>
    /// Comma-separated CIDR ranges. As an environment variable:
    /// <c>ForwardedHeaders__KnownNetworks=172.16.0.0/12</c>.
    /// </summary>
    public const string KnownNetworksKey = "ForwardedHeaders:KnownNetworks";

    /// <summary>The two keys in environment-variable form, for messages aimed at operators.</summary>
    public const string KnownProxiesEnvVar = "ForwardedHeaders__KnownProxies";

    public const string KnownNetworksEnvVar = "ForwardedHeaders__KnownNetworks";

    /// <summary>
    /// The options to pass to <c>UseForwardedHeaders</c>, or <see langword="null"/>
    /// when no proxy is trusted and the middleware must not be registered.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// An entry is not an IP address or a CIDR range. Failing the start is deliberate:
    /// a typo that silently trusted nothing would look exactly like a proxy that had
    /// stopped forwarding, and a typo that silently trusted everything would be a hole.
    /// </exception>
    public static ForwardedHeadersOptions? Resolve(IConfiguration configuration)
    {
        var proxies = ParseProxies(configuration[KnownProxiesKey]);
        var networks = ParseNetworks(configuration[KnownNetworksKey]);

        if (proxies.Count == 0 && networks.Count == 0)
            return null;

        var options = new ForwardedHeadersOptions
        {
            // X-Forwarded-Host is deliberately left out. Nothing here builds links or
            // redirects from Request.Host, so forwarding it would add attack surface
            // for no behaviour.
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
            // One trusted hop. ForwardLimit's default is already 1; it is written out
            // because raising it is a security decision, not a tuning knob.
            ForwardLimit = 1
        };

        // The framework pre-populates KnownProxies with ::1 and KnownNetworks with
        // loopback. Clear them: the operator names the proxy, and on this stack
        // loopback is not it.
        options.KnownProxies.Clear();
        options.KnownNetworks.Clear();

        foreach (var proxy in proxies)
            options.KnownProxies.Add(proxy);
        foreach (var network in networks)
            options.KnownNetworks.Add(network);

        return options;
    }

    /// <summary>A one-line summary of who is trusted, for the startup log.</summary>
    public static string Describe(ForwardedHeadersOptions options)
    {
        var parts = options.KnownProxies.Select(p => p.ToString())
            .Concat(options.KnownNetworks.Select(n => $"{n.Prefix}/{n.PrefixLength}"));

        return string.Join(", ", parts);
    }

    private static List<IPAddress> ParseProxies(string? value)
    {
        var result = new List<IPAddress>();

        foreach (var entry in Split(value))
        {
            if (!IPAddress.TryParse(entry, out var address))
                throw new InvalidOperationException(
                    $"{KnownProxiesEnvVar}: '{entry}' is not an IP address.");

            result.Add(address);
        }

        return result;
    }

    private static List<ProxyNetwork> ParseNetworks(string? value)
    {
        var result = new List<ProxyNetwork>();

        foreach (var entry in Split(value))
        {
            var slash = entry.IndexOf('/');
            if (slash <= 0
                || !IPAddress.TryParse(entry[..slash], out var prefix)
                || !int.TryParse(entry[(slash + 1)..], out var prefixLength)
                || prefixLength < 0
                || prefixLength > (prefix.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6 ? 128 : 32))
            {
                throw new InvalidOperationException(
                    $"{KnownNetworksEnvVar}: '{entry}' is not a CIDR range such as 172.16.0.0/12.");
            }

            result.Add(new ProxyNetwork(prefix, prefixLength));
        }

        return result;
    }

    private static IEnumerable<string> Split(string? value) =>
        (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
