using System.Text.Json;
using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Api.Middleware;
using HamptonHawksPlantSales.Core.DTOs;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace HamptonHawksPlantSales.Tests.Services;

public class ResponseEnvelopeTests
{
    [Fact]
    public void ApiResponseFail_IncludesDataNull_WhenSerializedWithIgnoreNulls()
    {
        var response = ApiResponse<object>.Fail("boom");
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

        var json = JsonSerializer.Serialize(response, options);

        Assert.Contains("\"success\":false", json);
        Assert.Contains("\"data\":null", json);
        Assert.Contains("\"errors\":[\"boom\"]", json);
    }

    [Fact]
    public async Task ExceptionMiddleware_ReturnsEnvelopeWithDataNull()
    {
        var middleware = new ExceptionHandlerMiddleware(
            _ => throw new ValidationException("bad request"),
            NullLogger<ExceptionHandlerMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var json = await reader.ReadToEndAsync();

        Assert.Equal(400, context.Response.StatusCode);
        Assert.Contains("\"success\":false", json);
        Assert.Contains("\"data\":null", json);
        Assert.Contains("bad request", json);
    }

    [Fact]
    public void VersionEndpoint_ReturnsStandardEnvelope()
    {
        var controller = new VersionController();

        var actionResult = controller.GetVersion();

        var ok = Assert.IsType<OkObjectResult>(actionResult);
        var envelope = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Empty(envelope.Errors);
        Assert.NotNull(envelope.Data);
    }
}
