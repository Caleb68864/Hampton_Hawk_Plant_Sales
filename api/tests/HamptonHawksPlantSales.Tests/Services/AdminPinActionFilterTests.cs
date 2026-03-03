using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Tests.Services;

public class AdminPinActionFilterTests
{
    [Fact]
    public async Task ForceComplete_WithoutPinHeader_Returns403()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>();
        context.HttpContext.Request.Headers["X-Admin-Reason"] = "test";

        await filter.OnActionExecutionAsync(context, () => Task.FromResult<ActionExecutedContext>(null!));

        var result = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, result.StatusCode);
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        Assert.False(payload.Success);
        Assert.Contains("Invalid or missing admin PIN.", payload.Errors);
    }

    [Fact]
    public async Task ForceComplete_WithoutReasonHeader_Returns403()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>();
        context.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";

        await filter.OnActionExecutionAsync(context, () => Task.FromResult<ActionExecutedContext>(null!));

        var result = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, result.StatusCode);
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        Assert.False(payload.Success);
        Assert.Contains("Reason is required.", payload.Errors);
    }

    [Fact]
    public async Task ForceComplete_WithPinAndReason_AllowsRequest()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>();
        context.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";
        context.HttpContext.Request.Headers["X-Admin-Reason"] = "override";
        var nextCalled = false;

        await filter.OnActionExecutionAsync(
            context,
            () =>
            {
                nextCalled = true;
                return Task.FromResult(new ActionExecutedContext(context, new List<IFilterMetadata>(), new object()));
            });

        Assert.True(nextCalled);
        Assert.Null(context.Result);
        Assert.Equal("override", context.HttpContext.Items["AdminReason"]);
    }

    [Fact]
    public void AdminActionsGetAllEndpoint_IsDecoratedWithRequiresAdminPin()
    {
        var method = typeof(AdminActionsController).GetMethod("GetAll");
        Assert.NotNull(method);
        Assert.Contains(method!.GetCustomAttributes(inherit: true), a => a is RequiresAdminPinAttribute);
    }

    [Fact]
    public void FulfillmentForceCompleteEndpoint_IsDecoratedWithRequiresAdminPin()
    {
        var method = typeof(FulfillmentController).GetMethod("ForceComplete");
        Assert.NotNull(method);
        Assert.Contains(method!.GetCustomAttributes(inherit: true), a => a is RequiresAdminPinAttribute);
    }

    private static AdminPinActionFilter BuildFilter(string adminPin)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AdminPin"] = adminPin
            })
            .Build();

        return new AdminPinActionFilter(config);
    }

    private static ActionExecutingContext BuildContext<TAttribute>() where TAttribute : Attribute, new()
    {
        var httpContext = new DefaultHttpContext();
        var routeData = new RouteData();
        var actionDescriptor = new ControllerActionDescriptor
        {
            EndpointMetadata = new List<object> { new TAttribute() }
        };

        var actionContext = new ActionContext(httpContext, routeData, actionDescriptor);

        return new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            new object());
    }
}
