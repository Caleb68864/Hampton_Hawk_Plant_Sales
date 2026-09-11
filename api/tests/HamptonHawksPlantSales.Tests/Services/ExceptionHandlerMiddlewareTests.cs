using System.Text.Json;
using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Api.Middleware;
using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class ExceptionHandlerMiddlewareTests
{
    private static (DefaultHttpContext Context, MemoryStream Body) NewContext()
    {
        var body = new MemoryStream();
        var context = new DefaultHttpContext();
        context.Response.Body = body;
        return (context, body);
    }

    [Fact]
    public async Task ValidationException_Maps400_AndLogsAtWarning()
    {
        var logger = new Mock<ILogger<ExceptionHandlerMiddleware>>();
        var middleware = new ExceptionHandlerMiddleware(_ => throw new ValidationException("bad input"), logger.Object);
        var (context, body) = NewContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(400);
        body.Position = 0;
        var envelope = await JsonSerializer.DeserializeAsync<ApiResponse<object>>(body,
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        envelope!.Errors.Should().Contain("bad input");

        logger.Verify(l => l.Log(LogLevel.Warning, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Once);
        logger.Verify(l => l.Log(LogLevel.Error, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Never);
    }

    [Fact]
    public async Task ClientDisconnect_WritesNothingAndLogsNo500()
    {
        var logger = new Mock<ILogger<ExceptionHandlerMiddleware>>();
        using var cts = new CancellationTokenSource();
        var middleware = new ExceptionHandlerMiddleware(ctx =>
        {
            cts.Cancel();
            throw new OperationCanceledException(cts.Token);
        }, logger.Object);
        var (context, body) = NewContext();
        context.RequestAborted = cts.Token;

        await middleware.InvokeAsync(context);

        body.Length.Should().Be(0);
        logger.Verify(l => l.Log(LogLevel.Error, It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception?>(),
            It.IsAny<Func<It.IsAnyType, Exception?, string>>()), Times.Never);
    }

    [Fact]
    public async Task CancellationWithoutClientDisconnect_IsStillA500()
    {
        var logger = new Mock<ILogger<ExceptionHandlerMiddleware>>();
        var middleware = new ExceptionHandlerMiddleware(_ => throw new OperationCanceledException(), logger.Object);
        var (context, _) = NewContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ResponseAlreadyStarted_DoesNotRewriteTheResponse()
    {
        var logger = new Mock<ILogger<ExceptionHandlerMiddleware>>();
        var middleware = new ExceptionHandlerMiddleware(_ => throw new InvalidOperationException("late"), logger.Object);
        var (context, body) = NewContext();
        context.Features.Set<IHttpResponseFeature>(new StartedResponseFeature());
        context.Response.StatusCode = 200;

        var act = () => middleware.InvokeAsync(context);

        await act.Should().NotThrowAsync();
        context.Response.StatusCode.Should().Be(200);
        body.Length.Should().Be(0);
    }

    private sealed class StartedResponseFeature : HttpResponseFeature
    {
        public override bool HasStarted => true;
    }
}
