using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HamptonHawksPlantSales.Api.Configuration;

/// <summary>
/// Decides whether the session cookie carries the <c>Secure</c> attribute.
/// </summary>
public static class SessionCookiePolicy
{
    /// <summary>
    /// Configuration key for the opt-in. As an environment variable:
    /// <c>Session__AllowInsecureCookieOverHttp=true</c>.
    /// </summary>
    public const string AllowInsecureOverHttpKey = "Session:AllowInsecureCookieOverHttp";

    /// <summary>The same key in environment-variable form, for messages aimed at operators.</summary>
    public const string AllowInsecureOverHttpEnvVar = "Session__AllowInsecureCookieOverHttp";

    /// <summary>
    /// True only when the operator explicitly opted in. Anything else -- unset,
    /// empty, "false", "0", a typo -- is off, so the default stays Secure-always.
    /// </summary>
    public static bool AllowInsecureOverHttp(IConfiguration configuration)
    {
        var value = configuration[AllowInsecureOverHttpKey]?.Trim();

        if (string.IsNullOrEmpty(value))
            return false;

        return value.Equals("true", StringComparison.OrdinalIgnoreCase)
            || value.Equals("1", StringComparison.Ordinal);
    }

    /// <summary>
    /// <para>
    /// Default (flag off): <see cref="CookieSecurePolicy.SameAsRequest"/> in
    /// Development, <see cref="CookieSecurePolicy.Always"/> everywhere else -- the
    /// behaviour this app has always shipped.
    /// </para>
    /// <para>
    /// Flag on: <see cref="CookieSecurePolicy.SameAsRequest"/>, which is *not* the
    /// same as never marking the cookie Secure. An https request still gets a
    /// Secure cookie; only a plain-http request gets one without it, because a
    /// browser refuses to return a Secure cookie to an http origin that is not
    /// localhost, and the phones at the sale reach the laptop by LAN IP over http.
    /// </para>
    /// </summary>
    public static CookieSecurePolicy ResolveSecurePolicy(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment() || AllowInsecureOverHttp(configuration))
            return CookieSecurePolicy.SameAsRequest;

        return CookieSecurePolicy.Always;
    }
}
