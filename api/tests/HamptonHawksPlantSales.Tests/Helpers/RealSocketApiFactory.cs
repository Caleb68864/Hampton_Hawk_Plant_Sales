using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace HamptonHawksPlantSales.Tests.Helpers;

/// <summary>
/// <see cref="RealCookieAuthApiFactory"/> served over a real TCP socket by Kestrel
/// instead of the in-memory <c>TestServer</c>.
///
/// <para>
/// This exists for one reason: <c>TestServer</c> leaves
/// <c>HttpContext.Connection.RemoteIpAddress</c> null, and
/// <c>ForwardedHeadersMiddleware</c> explicitly skips its known-proxy check when the
/// remote address is null ("allow remoteIp to be null for servers that don't support
/// it natively"). A trust test run on <c>TestServer</c> would therefore honour
/// <c>X-Forwarded-*</c> from anywhere and pass no matter how the trust list is
/// configured — it would prove the opposite of what it claims.
/// </para>
///
/// <para>
/// Over a real socket the peer address is really <c>127.0.0.1</c>, so a test makes a
/// hop trusted by naming <c>127.0.0.1</c> in configuration and makes the same client
/// untrusted by naming some other address. Nothing is stubbed.
/// </para>
/// </summary>
public sealed class RealSocketApiFactory : RealCookieAuthApiFactory
{
    private IHost? _kestrelHost;

    /// <summary>The <c>http://127.0.0.1:&lt;port&gt;</c> Kestrel actually bound.</summary>
    public Uri ServerAddress { get; private set; } = new("http://127.0.0.1");

    public RealSocketApiFactory(IReadOnlyDictionary<string, string?>? settings = null)
        : base(settings)
    {
    }

    /// <summary>An <see cref="HttpClient"/> aimed at the real socket, with cookies off
    /// so a test decides for itself which cookie to replay.</summary>
    public HttpClient CreateSocketClient()
    {
        // Touch the base factory so the host (and therefore Kestrel) is started.
        _ = Services;

        var handler = new HttpClientHandler { UseCookies = false, AllowAutoRedirect = false };
        return new HttpClient(handler) { BaseAddress = ServerAddress };
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // WebApplicationFactory still wants its in-memory host, so build that first
        // and hand it back; the Kestrel host below is the one the tests talk to.
        var testHost = builder.Build();

        builder.ConfigureWebHost(webHost => webHost.UseKestrel().UseUrls("http://127.0.0.1:0"));
        _kestrelHost = builder.Build();
        _kestrelHost.Start();

        var addresses = _kestrelHost.Services.GetRequiredService<IServer>()
            .Features.Get<IServerAddressesFeature>()
            ?? throw new InvalidOperationException("Kestrel reported no server addresses.");
        ServerAddress = new Uri(addresses.Addresses.First());

        testHost.Start();
        return testHost;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
            _kestrelHost?.Dispose();
    }
}
