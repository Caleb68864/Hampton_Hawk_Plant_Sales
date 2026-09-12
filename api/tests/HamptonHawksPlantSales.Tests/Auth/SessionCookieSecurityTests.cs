using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// Exercises the session cookie the way a phone does: a real POST to
/// <c>/api/auth/login</c>, the real <c>Set-Cookie</c> header that comes back, and a
/// real follow-up GET to <c>/api/auth/me</c> through a cookie jar that obeys the
/// <c>Secure</c> attribute (<see cref="CookieContainer"/> withholds a secure cookie
/// from an <c>http://</c> request exactly as a browser does).
///
/// <para>
/// Asserting on <c>CookieAuthenticationOptions.Cookie.SecurePolicy</c> instead would
/// prove nothing about whether a session survives, which is the only thing the
/// volunteer with the phone cares about.
/// </para>
/// </summary>
public class SessionCookieSecurityTests
{
    private const string FlagKey = "Session:AllowInsecureCookieOverHttp";
    private const string CookieName = "HH.Session";

    /// <summary>Today's shipped behaviour, and the reason phones cannot stay logged in.</summary>
    [Fact]
    public async Task FlagOff_OverPlainHttp_SetsSecureCookie_AndTheSessionIsGoneOnTheNextRequest()
    {
        await using var factory = new RealCookieAuthApiFactory();
        var jar = new CookieContainer();
        using var client = factory.CreateDefaultClient(
            new Uri("http://hampton-laptop.lan:3000"), new CookieContainerHandler(jar));

        var setCookie = await LoginAndReadSetCookieAsync(client);

        setCookie.Should().Contain("secure", "the deployed API runs as Production, which forces CookieSecurePolicy.Always");

        // A browser on plain http refuses to send a Secure cookie back, so the very
        // next request arrives anonymous: log in, immediately logged out.
        var me = await client.GetAsync("/api/auth/me");
        me.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            "a Secure cookie is never returned over http, so the session cannot survive one request");
    }

    /// <summary>The opt-in: a plain-http LAN request gets a cookie the phone can actually return.</summary>
    [Fact]
    public async Task FlagOn_OverPlainHttp_OmitsSecure_AndTheSessionSurvivesTheNextRequest()
    {
        await using var factory = new RealCookieAuthApiFactory(
            new Dictionary<string, string?> { [FlagKey] = "true" });
        var jar = new CookieContainer();
        using var client = factory.CreateDefaultClient(
            new Uri("http://hampton-laptop.lan:3000"), new CookieContainerHandler(jar));

        var setCookie = await LoginAndReadSetCookieAsync(client);

        setCookie.Should().NotContain("secure", "the whole point of the flag is a cookie a plain-http phone can return");

        // Not weakened by the opt-in.
        setCookie.Should().Contain("httponly");
        setCookie.Should().Contain("samesite=strict");

        var me = await client.GetAsync("/api/auth/me");
        me.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await me.Content.ReadFromJsonAsync<MeEnvelope>();
        body!.Success.Should().BeTrue();
        body.Data!.Username.Should().Be(RealCookieAuthApiFactory.AdminUsername);
    }

    /// <summary>
    /// The control that stops "SameAsRequest" quietly becoming "never Secure": with
    /// the flag on, an https request must still get a Secure cookie.
    /// </summary>
    [Fact]
    public async Task FlagOn_OverHttps_StillSetsSecureCookie()
    {
        await using var factory = new RealCookieAuthApiFactory(
            new Dictionary<string, string?> { [FlagKey] = "true" });
        var jar = new CookieContainer();
        using var client = factory.CreateDefaultClient(
            new Uri("https://plantsales.example.org"), new CookieContainerHandler(jar));

        var setCookie = await LoginAndReadSetCookieAsync(client);

        setCookie.Should().Contain("secure", "the flag downgrades plain http only, never an https request");
        setCookie.Should().Contain("httponly");
        setCookie.Should().Contain("samesite=strict");

        var me = await client.GetAsync("/api/auth/me");
        me.StatusCode.Should().Be(HttpStatusCode.OK, "https returns the Secure cookie, so the session works");
    }

    private static async Task<string> LoginAndReadSetCookieAsync(HttpClient client)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            username = RealCookieAuthApiFactory.AdminUsername,
            password = RealCookieAuthApiFactory.AdminPassword
        });

        login.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await login.Content.ReadFromJsonAsync<MeEnvelope>();
        envelope!.Success.Should().BeTrue("the bootstrap admin must really sign in, or the cookie means nothing");

        var setCookie = login.Headers
            .GetValues("Set-Cookie")
            .Single(value => value.StartsWith($"{CookieName}=", StringComparison.Ordinal));

        // The header is the evidence; print it so a CI log shows what was asserted.
        Console.WriteLine($"Set-Cookie: {setCookie}");

        return setCookie.ToLowerInvariant();
    }

    private sealed record MeEnvelope(bool Success, MeUser? Data, List<string>? Errors);

    private sealed record MeUser(Guid Id, string Username, bool IsActive, List<string> Roles);
}
