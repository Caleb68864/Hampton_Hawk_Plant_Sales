using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using HamptonHawksPlantSales.Api.Configuration;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// What the API believes about a request that arrived through a reverse proxy.
///
/// <para>
/// Every test here drives the real <c>Program.cs</c> pipeline over a real TCP socket
/// (<see cref="RealSocketApiFactory"/>) and asserts on what came back on the wire:
/// the <c>Set-Cookie</c> header, and the 200/429 the login rate limiter produces.
/// </para>
///
/// <para>
/// The scheme is read out through the session cookie on purpose. With
/// <c>Session:AllowInsecureCookieOverHttp</c> on, the cookie's <c>Secure</c>
/// attribute is <c>CookieSecurePolicy.SameAsRequest</c>, i.e. a direct readout of
/// <c>Request.IsHttps</c> — so "does the app think this is https" and "does a
/// volunteer's cookie go out protected" are the same question, which is the whole
/// reason the two settings have to be considered together.
/// </para>
/// </summary>
public class ForwardedHeadersTests
{
    private const string LanFlagKey = "Session:AllowInsecureCookieOverHttp";
    private const string KnownProxiesKey = "ForwardedHeaders:KnownProxies";
    private const string CookieName = "HH.Session";

    /// <summary>The address Kestrel's client really connects from in these tests.</summary>
    private const string TheHopWeConnectFrom = "127.0.0.1";

    /// <summary>A TEST-NET-1 address (RFC 5737) that is deliberately not the client.</summary>
    private const string SomeOtherAddress = "192.0.2.10";

    // ---------------------------------------------------------------- scheme

    /// <summary>
    /// An https reverse proxy terminates TLS and forwards over http. The app must
    /// treat that request as https, so the session cookie keeps <c>Secure</c> even
    /// with the LAN flag on.
    /// </summary>
    [Fact]
    public async Task TrustedProxy_ForwardingHttps_IsTreatedAsHttps_SoTheCookieStaysSecure()
    {
        await using var factory = new RealSocketApiFactory(new Dictionary<string, string?>
        {
            [LanFlagKey] = "true",
            [KnownProxiesKey] = TheHopWeConnectFrom
        });
        using var client = factory.CreateSocketClient();

        var (setCookie, cookie) = await LoginAsync(client, proto: "https");

        setCookie.Should().Contain("secure",
            "a trusted hop said the client's request was https, so the cookie must go back protected");
        setCookie.Should().Contain("httponly");
        setCookie.Should().Contain("samesite=strict");

        // The login was real: the cookie authenticates a following request.
        var me = await GetMeAsync(client, cookie, proto: "https");
        me.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await me.Content.ReadFromJsonAsync<MeEnvelope>();
        body!.Data!.Username.Should().Be(RealCookieAuthApiFactory.AdminUsername);
    }

    /// <summary>
    /// The control. The same header, from a client that is not the configured proxy,
    /// must change nothing — otherwise anyone on the LAN could claim https and talk
    /// the app into a cookie policy the operator did not choose.
    /// </summary>
    [Fact]
    public async Task UntrustedClient_ClaimingHttps_IsIgnored()
    {
        await using var factory = new RealSocketApiFactory(new Dictionary<string, string?>
        {
            [LanFlagKey] = "true",
            // Trust exists, but it is not this client.
            [KnownProxiesKey] = SomeOtherAddress
        });
        using var client = factory.CreateSocketClient();

        var (setCookie, cookie) = await LoginAsync(client, proto: "https");

        setCookie.Should().NotContain("secure",
            "the request really was plain http; an untrusted client does not get to say otherwise");

        var me = await GetMeAsync(client, cookie, proto: "https");
        me.StatusCode.Should().Be(HttpStatusCode.OK, "the login itself is unaffected — only the lie is");
    }

    /// <summary>
    /// The shipped default: nothing is configured as a proxy, so <c>X-Forwarded-*</c>
    /// is inert no matter who sends it. This is the deployment on the sale-day LAN.
    /// </summary>
    [Fact]
    public async Task NoTrustedProxyConfigured_ClaimingHttps_IsIgnored()
    {
        await using var factory = new RealSocketApiFactory(new Dictionary<string, string?>
        {
            [LanFlagKey] = "true"
        });
        using var client = factory.CreateSocketClient();

        var (setCookie, _) = await LoginAsync(client, proto: "https");

        setCookie.Should().NotContain("secure",
            "with no trusted proxy named, forwarded headers are not read at all");
    }

    /// <summary>
    /// With no forwarded headers on the request, behaviour is exactly what it was
    /// before any of this existed — both sides of the LAN flag.
    /// </summary>
    [Theory]
    [InlineData("true", false)]
    [InlineData(null, true)]
    public async Task NoForwardedHeaders_BehavesExactlyAsBefore(string? lanFlag, bool expectSecure)
    {
        var settings = new Dictionary<string, string?> { [KnownProxiesKey] = TheHopWeConnectFrom };
        if (lanFlag is not null)
            settings[LanFlagKey] = lanFlag;

        await using var factory = new RealSocketApiFactory(settings);
        using var client = factory.CreateSocketClient();

        var (setCookie, _) = await LoginAsync(client, proto: null);

        if (expectSecure)
            setCookie.Should().Contain("secure", "Production forces CookieSecurePolicy.Always with the flag off");
        else
            setCookie.Should().NotContain("secure", "a plain-http request with the flag on is still plain http");
    }

    // -------------------------------------------------------- client address

    /// <summary>
    /// The login throttle partitions on the client address. Behind a trusted proxy
    /// that must be the phone's address, not the proxy's — otherwise one volunteer
    /// fat-fingering a password locks out every phone at the sale.
    /// </summary>
    [Fact]
    public async Task TrustedProxy_ForwardedFor_ThrottlesEachPhoneSeparately()
    {
        await using var factory = new RealSocketApiFactory(new Dictionary<string, string?>
        {
            [KnownProxiesKey] = TheHopWeConnectFrom
        });
        using var client = factory.CreateSocketClient();

        await ExhaustLoginBudgetAsync(client, forwardedFor: "203.0.113.7");

        var otherPhone = await AttemptLoginAsync(client, forwardedFor: "203.0.113.8");
        otherPhone.StatusCode.Should().Be(HttpStatusCode.OK,
            "a second phone behind the same trusted proxy has its own budget");
    }

    /// <summary>
    /// The control for the address half: an untrusted client cannot mint fresh
    /// rate-limit budget (or fresh log lines) by inventing an <c>X-Forwarded-For</c>.
    /// </summary>
    [Fact]
    public async Task UntrustedClient_CannotMintRateLimitBudgetWithForwardedFor()
    {
        await using var factory = new RealSocketApiFactory(new Dictionary<string, string?>
        {
            [KnownProxiesKey] = SomeOtherAddress
        });
        using var client = factory.CreateSocketClient();

        await ExhaustLoginBudgetAsync(client, forwardedFor: "203.0.113.7");

        var sameClientNewLie = await AttemptLoginAsync(client, forwardedFor: "203.0.113.8");
        sameClientNewLie.StatusCode.Should().Be(HttpStatusCode.TooManyRequests,
            "the socket address is still the only identity, so the budget is still spent");
    }

    // ------------------------------------------------------------- plumbing

    private static async Task ExhaustLoginBudgetAsync(HttpClient client, string forwardedFor)
    {
        for (var i = 0; i < RateLimitPolicies.LoginPermitLimit; i++)
        {
            var allowed = await AttemptLoginAsync(client, forwardedFor);
            allowed.StatusCode.Should().Be(HttpStatusCode.OK, $"attempt {i + 1} is within the window budget");
        }

        var throttled = await AttemptLoginAsync(client, forwardedFor);
        throttled.StatusCode.Should().Be(HttpStatusCode.TooManyRequests,
            "the budget for this identity must really be spent, or the test that follows proves nothing");
    }

    private static Task<HttpResponseMessage> AttemptLoginAsync(HttpClient client, string forwardedFor)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username = "nobody", password = "wrong-password" })
        };
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request);
    }

    private static async Task<(string SetCookie, string Cookie)> LoginAsync(HttpClient client, string? proto)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new
            {
                username = RealCookieAuthApiFactory.AdminUsername,
                password = RealCookieAuthApiFactory.AdminPassword
            })
        };
        if (proto is not null)
            request.Headers.Add("X-Forwarded-Proto", proto);

        var login = await client.SendAsync(request);
        login.StatusCode.Should().Be(HttpStatusCode.OK);
        var envelope = await login.Content.ReadFromJsonAsync<MeEnvelope>();
        envelope!.Success.Should().BeTrue("the bootstrap admin must really sign in, or the cookie means nothing");

        var setCookie = login.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith($"{CookieName}=", StringComparison.Ordinal));

        // The header is the evidence; print it so a CI log shows what was asserted.
        Console.WriteLine($"X-Forwarded-Proto: {proto ?? "<none>"} -> Set-Cookie: {setCookie}");

        var cookie = setCookie.Split(';')[0];
        return (setCookie.ToLowerInvariant(), cookie);
    }

    private static Task<HttpResponseMessage> GetMeAsync(HttpClient client, string cookie, string? proto)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Add("Cookie", cookie);
        if (proto is not null)
            request.Headers.Add("X-Forwarded-Proto", proto);
        return client.SendAsync(request);
    }

    private sealed record MeEnvelope(bool Success, MeUser? Data, List<string>? Errors);

    private sealed record MeUser(Guid Id, string Username, bool IsActive, List<string> Roles);
}
