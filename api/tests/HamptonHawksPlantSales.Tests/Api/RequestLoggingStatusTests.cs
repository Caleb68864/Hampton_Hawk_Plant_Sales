using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.AspNetCore;
using Serilog.Core;
using Serilog.Events;

namespace HamptonHawksPlantSales.Tests.Api;

/// <summary>
/// The request log line must report the status the client actually got. When
/// request logging sat inside <c>ExceptionHandlerMiddleware</c>, every exception the
/// handler maps to a 4xx (an over-availability refusal at the register, a missing
/// record) passed through it first and was logged as an Error "responded 500"
/// with a stack trace, so a sale-day log was full of 500s that never happened.
/// </summary>
public class RequestLoggingStatusTests
{
    private sealed class CollectingSink : ILogEventSink
    {
        public List<LogEvent> Events { get; } = new();
        public void Emit(LogEvent logEvent)
        {
            lock (Events) Events.Add(logEvent);
        }
    }

    [Fact]
    public async Task Exception_mapped_to_404_is_logged_with_404_not_500()
    {
        var sink = new CollectingSink();
        var logger = new LoggerConfiguration().MinimumLevel.Verbose().WriteTo.Sink(sink).CreateLogger();

        await using var factory = new TestApiFactory().WithWebHostBuilder(b =>
            b.ConfigureServices(s => s.Configure<RequestLoggingOptions>(o => o.Logger = logger)));
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Test");

        var response = await client.PutAsJsonAsync($"/api/customers/{Guid.NewGuid()}", new { displayName = "Nobody" });
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var requestLog = sink.Events.Should().ContainSingle(e =>
            e.Properties.ContainsKey("StatusCode") && e.Properties.ContainsKey("RequestPath")).Subject;
        requestLog.Properties["StatusCode"].ToString().Should().Be("404");
        requestLog.Level.Should().Be(LogEventLevel.Information);
        requestLog.Exception.Should().BeNull();
    }
}
