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

    [Theory]
    [InlineData("40001", 409)]
    [InlineData("40P01", 409)]
    [InlineData("23514", 400)]
    [InlineData("23505", 409)]
    [InlineData("23503", 409)]
    [InlineData("22003", 400)]
    public async Task DatabaseRefusals_AreNot500s_AndDoNotEchoPostgresText(string sqlState, int expected)
    {
        // Wrapped the way EF surfaces a failed save.
        var pg = new Npgsql.PostgresException("raw postgres detail", "ERROR", "ERROR", sqlState);
        var thrown = new Microsoft.EntityFrameworkCore.DbUpdateException("An error occurred while saving the entity changes.", pg);
        var middleware = new ExceptionHandlerMiddleware(_ => throw thrown, new Mock<ILogger<ExceptionHandlerMiddleware>>().Object);
        var (context, body) = NewContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(expected);
        body.Position = 0;
        var text = await new StreamReader(body).ReadToEndAsync();
        text.Should().NotContain("raw postgres detail");
    }

    [Fact]
    public async Task AnUnrecognisedDatabaseError_IsStillA500()
    {
        var pg = new Npgsql.PostgresException("relation does not exist", "ERROR", "ERROR", "42P01");
        var middleware = new ExceptionHandlerMiddleware(_ => throw pg, new Mock<ILogger<ExceptionHandlerMiddleware>>().Object);
        var (context, _) = NewContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task A500_SendsAReference_NotTheExceptionText()
    {
        var middleware = new ExceptionHandlerMiddleware(
            _ => throw new NullReferenceException("Object reference not set at OrderService.cs:412 SELECT * FROM secret"),
            new Mock<ILogger<ExceptionHandlerMiddleware>>().Object);
        var (context, body) = NewContext();
        context.TraceIdentifier = "trace-42";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(500);
        body.Position = 0;
        var text = await new StreamReader(body).ReadToEndAsync();
        text.Should().NotContain("SELECT").And.NotContain("OrderService.cs");
        text.Should().Contain("reference trace-42");
    }
}
