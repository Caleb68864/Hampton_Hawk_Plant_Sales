using System.Security.Cryptography;
using System.Text;
using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;

namespace HamptonHawksPlantSales.Api.Filters;

public class AdminPinActionFilter : IAsyncActionFilter
{
    /// <summary>Rejected PIN attempts allowed per client address per window before lockout.</summary>
    public const int MaxFailuresPerWindow = 30;

    /// <summary>Length of the failure-counting window.</summary>
    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(1);

    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<AdminPinActionFilter> _logger;

    public AdminPinActionFilter(IConfiguration configuration, IMemoryCache cache, ILogger<AdminPinActionFilter> logger)
    {
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var hasAttribute = context.ActionDescriptor.EndpointMetadata
            .Any(m => m is RequiresAdminPinAttribute);

        if (!hasAttribute)
        {
            await next();
            return;
        }

        var expectedPin = Environment.GetEnvironmentVariable("APP_ADMIN_PIN")
            ?? _configuration["AdminPin"]
            ?? string.Empty;

        var httpContext = context.HttpContext;
        var pin = httpContext.Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = httpContext.Request.Headers["X-Admin-Reason"].FirstOrDefault();
        var method = httpContext.Request.Method;
        var requiresReason = HttpMethods.IsPost(method)
            || HttpMethods.IsPut(method)
            || HttpMethods.IsPatch(method)
            || HttpMethods.IsDelete(method);

        // Only failures count toward the lockout: a volunteer using the PIN correctly
        // all day must never be throttled, but a client guessing PINs is cut off.
        var clientKey = ClientKey(httpContext);
        var failureKey = $"admin-pin-failures:{clientKey}";
        if (_cache.TryGetValue<FailureCounter>(failureKey, out var failures) && failures!.Count >= MaxFailuresPerWindow)
        {
            _logger.LogWarning("Admin PIN locked out for {Client} after {Failures} failures (user {User}).",
                clientKey, failures.Count, httpContext.User.Identity?.Name ?? "anonymous");
            context.Result = new JsonResult(ApiResponse<object>.Fail("Too many admin PIN attempts. Try again in a minute."))
            {
                StatusCode = StatusCodes.Status429TooManyRequests
            };
            return;
        }

        // Fail closed when no PIN is configured, and compare in constant time so the
        // response timing does not leak how much of a guess matched.
        if (string.IsNullOrWhiteSpace(pin) || !PinMatches(pin, expectedPin))
        {
            RecordFailure(failureKey);
            _logger.LogWarning("Admin PIN rejected for user {User} from {Client} on {Method} {Path}.",
                httpContext.User.Identity?.Name ?? "anonymous", clientKey, method, httpContext.Request.Path);

            context.Result = new JsonResult(ApiResponse<object>.Fail("Invalid or missing admin PIN."))
            {
                StatusCode = 403
            };
            return;
        }

        if (requiresReason && string.IsNullOrWhiteSpace(reason))
        {
            context.Result = new JsonResult(ApiResponse<object>.Fail("Reason is required."))
            {
                StatusCode = 403
            };
            return;
        }

        if (!string.IsNullOrWhiteSpace(reason))
        {
            httpContext.Items["AdminReason"] = reason;
        }

        await next();
    }

    private static bool PinMatches(string pin, string expectedPin)
    {
        if (expectedPin.Length == 0) return false;

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(pin),
            Encoding.UTF8.GetBytes(expectedPin));
    }

    private void RecordFailure(string failureKey)
    {
        // The window starts at the first failure and the counter is dropped when it
        // lapses; the counter is a reference so later failures never extend it.
        var counter = _cache.GetOrCreate(failureKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = FailureWindow;
            return new FailureCounter();
        })!;
        Interlocked.Increment(ref counter.Count);
    }

    private sealed class FailureCounter
    {
        public int Count;
    }

    private static string ClientKey(HttpContext httpContext)
    {
        // The socket address, unless ForwardedHeaders__KnownProxies names the proxy
        // in front (see TrustedProxies), in which case the middleware has already
        // replaced it with the client address that proxy reported. With no proxy
        // trusted, every client behind one shares a key, which is acceptable: the
        // lockout is per-window and short.
        return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
