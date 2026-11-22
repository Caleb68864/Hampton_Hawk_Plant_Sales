using System.Net;
using System.Text.Json;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Data;
using Npgsql;

namespace HamptonHawksPlantSales.Api.Middleware;

public class ExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlerMiddleware> _logger;

    public ExceptionHandlerMiddleware(RequestDelegate next, ILogger<ExceptionHandlerMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away (scanner page navigated, phone locked). Not a
            // server fault: no 500 in the log, and nobody is listening for a body.
            _logger.LogDebug("Request {Method} {Path} aborted by client.", context.Request.Method, context.Request.Path);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            // Headers are already on the wire; writing a JSON envelope now would
            // corrupt the response. Log and let the connection close.
            _logger.LogError(exception, "Exception after response started for {Method} {Path}",
                context.Request.Method, context.Request.Path);
            return;
        }

        // Database refusals a volunteer can act on are not server faults. A
        // serialization conflict or deadlock that outlived the retries, or a
        // constraint that refused a write, used to come back as a 500 carrying
        // raw Postgres text.
        var (dbStatus, dbMessage) = ClassifyDatabaseRefusal(exception);

        var statusCode = dbStatus ?? exception switch
        {
            ValidationException => (int)HttpStatusCode.BadRequest,
            InvalidOperationException => (int)HttpStatusCode.BadRequest,
            ArgumentException => (int)HttpStatusCode.BadRequest,
            KeyNotFoundException => (int)HttpStatusCode.NotFound,
            _ => (int)HttpStatusCode.InternalServerError
        };

        if (statusCode == (int)HttpStatusCode.InternalServerError)
            _logger.LogError(exception, "Unhandled exception");
        else
            _logger.LogWarning("{ExceptionType} mapped to {StatusCode} for {Method} {Path}: {Message}",
                exception.GetType().Name, statusCode, context.Request.Method, context.Request.Path, exception.Message);

        var response = new ApiResponse<object>
        {
            Success = false,
            Errors = new List<string> { dbMessage ?? exception.Message }
        };

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, options));
    }

    private static (int? Status, string? Message) ClassifyDatabaseRefusal(Exception exception)
    {
        if (WalkUpRowLocks.IsRetryableConcurrencyFailure(exception))
            return ((int)HttpStatusCode.Conflict,
                "Another station changed this at the same moment. Wait a second, then try again.");

        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is not PostgresException pg) continue;
            return pg.SqlState switch
            {
                PostgresErrorCodes.CheckViolation => ((int)HttpStatusCode.BadRequest,
                    "That change conflicts with what has already been scanned or sold. Refresh and try again."),
                PostgresErrorCodes.UniqueViolation => ((int)HttpStatusCode.Conflict,
                    "That value is already in use. Refresh and try again."),
                PostgresErrorCodes.ForeignKeyViolation => ((int)HttpStatusCode.Conflict,
                    "That record is linked to something that no longer exists, or is still in use. Refresh and try again."),
                PostgresErrorCodes.NumericValueOutOfRange => ((int)HttpStatusCode.BadRequest,
                    "A number in that request is too large."),
                _ => (null, null)
            };
        }
        return (null, null);
    }
}
