using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace HamptonHawksPlantSales.Api.Filters;

public class AdminPinActionFilter : IAsyncActionFilter
{
    private readonly IConfiguration _configuration;

    public AdminPinActionFilter(IConfiguration configuration)
    {
        _configuration = configuration;
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

        var pin = context.HttpContext.Request.Headers["X-Admin-Pin"].FirstOrDefault();
        var reason = context.HttpContext.Request.Headers["X-Admin-Reason"].FirstOrDefault();
        var method = context.HttpContext.Request.Method;
        var requiresReason = HttpMethods.IsPost(method)
            || HttpMethods.IsPut(method)
            || HttpMethods.IsPatch(method)
            || HttpMethods.IsDelete(method);

        if (string.IsNullOrWhiteSpace(pin) || pin != expectedPin)
        {
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
            context.HttpContext.Items["AdminReason"] = reason;
        }

        await next();
    }
}
