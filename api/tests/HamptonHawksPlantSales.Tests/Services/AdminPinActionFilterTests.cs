using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Core.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace HamptonHawksPlantSales.Tests.Services;

public class AdminPinActionFilterTests
{
    [Fact]
    public async Task ForceComplete_WithoutPinHeader_Returns403()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
        context.HttpContext.Request.Headers["X-Admin-Reason"] = "test";

        await filter.OnActionExecutionAsync(context, () => Task.FromResult<ActionExecutedContext>(null!));

        var result = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, result.StatusCode);
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        Assert.False(payload.Success);
        Assert.Contains("Invalid or missing admin PIN.", payload.Errors);
    }

    [Fact]
    public async Task MutatingRequest_WithoutReasonHeader_Returns403()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
        context.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";

        await filter.OnActionExecutionAsync(context, () => Task.FromResult<ActionExecutedContext>(null!));

        var result = Assert.IsType<JsonResult>(context.Result);
        Assert.Equal(403, result.StatusCode);
        var payload = Assert.IsType<ApiResponse<object>>(result.Value);
        Assert.False(payload.Success);
        Assert.Contains("Reason is required.", payload.Errors);
    }

    [Fact]
    public async Task GetRequest_WithPinAndNoReason_AllowsRequest()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Get);
        context.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";
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
        Assert.False(context.HttpContext.Items.ContainsKey("AdminReason"));
    }

    [Fact]
    public async Task ForceComplete_WithPinAndReason_AllowsRequest()
    {
        var filter = BuildFilter("1234");
        var context = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
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
    public void AdminActionsVerifyPinEndpoint_IsDecoratedWithRequiresAdminPin()
    {
        var method = typeof(AdminActionsController).GetMethod("VerifyPin");
        Assert.NotNull(method);
        Assert.Contains(method!.GetCustomAttributes(inherit: true), a => a is RequiresAdminPinAttribute);
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

    [Fact]
    public async Task RepeatedWrongPins_LockOutTheClientWith429()
    {
        var filter = BuildFilter("1234");

        for (var i = 0; i < AdminPinActionFilter.MaxFailuresPerWindow; i++)
        {
            var attempt = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
            attempt.HttpContext.Request.Headers["X-Admin-Pin"] = "0000";
            attempt.HttpContext.Request.Headers["X-Admin-Reason"] = "guess";
            await filter.OnActionExecutionAsync(attempt, () => Task.FromResult<ActionExecutedContext>(null!));
            Assert.Equal(403, Assert.IsType<JsonResult>(attempt.Result).StatusCode);
        }

        // Even the correct PIN is refused once the window's failure budget is spent.
        var lockedOut = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
        lockedOut.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";
        lockedOut.HttpContext.Request.Headers["X-Admin-Reason"] = "real";
        var nextCalled = false;
        await filter.OnActionExecutionAsync(lockedOut, () =>
        {
            nextCalled = true;
            return Task.FromResult(new ActionExecutedContext(lockedOut, new List<IFilterMetadata>(), new object()));
        });

        Assert.False(nextCalled);
        Assert.Equal(429, Assert.IsType<JsonResult>(lockedOut.Result).StatusCode);
    }

    [Fact]
    public async Task CorrectPins_NeverCountTowardLockout()
    {
        var filter = BuildFilter("1234");

        for (var i = 0; i < AdminPinActionFilter.MaxFailuresPerWindow + 5; i++)
        {
            var attempt = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
            attempt.HttpContext.Request.Headers["X-Admin-Pin"] = "1234";
            attempt.HttpContext.Request.Headers["X-Admin-Reason"] = "ok";
            await filter.OnActionExecutionAsync(attempt, () =>
                Task.FromResult(new ActionExecutedContext(attempt, new List<IFilterMetadata>(), new object())));
            Assert.Null(attempt.Result);
        }
    }

    [Fact]
    public async Task NoPinConfigured_RejectsEveryPin()
    {
        var filter = BuildFilter("");
        var context = BuildContext<RequiresAdminPinAttribute>(HttpMethods.Post);
        context.HttpContext.Request.Headers["X-Admin-Pin"] = "";
        context.HttpContext.Request.Headers["X-Admin-Reason"] = "x";

        await filter.OnActionExecutionAsync(context, () => Task.FromResult<ActionExecutedContext>(null!));

        Assert.Equal(403, Assert.IsType<JsonResult>(context.Result).StatusCode);
    }

    private static AdminPinActionFilter BuildFilter(string adminPin)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AdminPin"] = adminPin
            })
            .Build();

        return new AdminPinActionFilter(config, new MemoryCache(new MemoryCacheOptions()), NullLogger<AdminPinActionFilter>.Instance);
    }

    private static ActionExecutingContext BuildContext<TAttribute>(string? method = null) where TAttribute : Attribute, new()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.Method = method ?? HttpMethods.Get;
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
