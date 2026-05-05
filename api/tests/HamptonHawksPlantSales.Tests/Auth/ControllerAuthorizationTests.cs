using System.Reflection;
using HamptonHawksPlantSales.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// Verifies that controller classes and actions carry the expected authorization attributes.
/// These tests protect against accidental removal of security constraints.
/// </summary>
public class ControllerAuthorizationTests
{
    private static Type GetController<T>() => typeof(T);

    private static AuthorizeAttribute? GetClassAuthorize<T>() =>
        typeof(T).GetCustomAttribute<AuthorizeAttribute>();

    private static string? GetClassPolicy<T>() =>
        GetClassAuthorize<T>()?.Policy;

    private static bool HasClassAttribute<T, TAttr>() where TAttr : Attribute =>
        typeof(T).GetCustomAttribute<TAttr>() is not null;

    private static bool ActionHasAttribute<TAttr>(Type controllerType, string methodName) where TAttr : Attribute =>
        controllerType.GetMethod(methodName)?.GetCustomAttribute<TAttr>() is not null;

    // ── AdminOnly controllers ──

    [Fact]
    public void UsersController_HasAdminOnlyPolicy()
    {
        Assert.Equal("AdminOnly", GetClassPolicy<UsersController>());
    }

    [Fact]
    public void AdminActionsController_HasAdminOnlyPolicy()
    {
        Assert.Equal("AdminOnly", GetClassPolicy<AdminActionsController>());
    }

    [Fact]
    public void SettingsController_HasAdminOnlyPolicy()
    {
        Assert.Equal("AdminOnly", GetClassPolicy<SettingsController>());
    }

    [Fact]
    public void ImportController_HasAdminOnlyPolicy()
    {
        Assert.Equal("AdminOnly", GetClassPolicy<ImportController>());
    }

    [Fact]
    public void InventoryController_HasAdminOnlyPolicy()
    {
        Assert.Equal("AdminOnly", GetClassPolicy<InventoryController>());
    }

    // ── Pickup/fulfillment controllers ──

    [Fact]
    public void FulfillmentController_HasPickupCapablePolicy()
    {
        Assert.Equal("PickupCapable", GetClassPolicy<FulfillmentController>());
    }

    [Fact]
    public void ScanSessionsController_HasPickupCapablePolicy()
    {
        Assert.Equal("PickupCapable", GetClassPolicy<ScanSessionsController>());
    }

    // ── Lookup/print controllers ──

    [Fact]
    public void CustomersController_HasLookupCapablePolicy()
    {
        Assert.Equal("LookupCapable", GetClassPolicy<CustomersController>());
    }

    [Fact]
    public void PlantsController_HasLookupCapablePolicy()
    {
        Assert.Equal("LookupCapable", GetClassPolicy<PlantsController>());
    }

    [Fact]
    public void SellersController_HasLookupCapablePolicy()
    {
        Assert.Equal("LookupCapable", GetClassPolicy<SellersController>());
    }

    // ── POS controllers ──

    [Fact]
    public void WalkUpController_HasPOSCapablePolicy()
    {
        Assert.Equal("POSCapable", GetClassPolicy<WalkUpController>());
    }

    [Fact]
    public void WalkUpRegisterController_HasPOSCapablePolicy()
    {
        Assert.Equal("POSCapable", GetClassPolicy<WalkUpRegisterController>());
    }

    // ── Reports controller ──

    [Fact]
    public void ReportsController_HasReportsCapablePolicy()
    {
        Assert.Equal("ReportsCapable", GetClassPolicy<ReportsController>());
    }

    // ── Orders controller requires authentication ──

    [Fact]
    public void OrdersController_RequiresAuthentication()
    {
        Assert.NotNull(GetClassAuthorize<OrdersController>());
    }

    // ── Auth controller is explicitly public for login ──

    [Fact]
    public void AuthController_Login_HasAllowAnonymous()
    {
        Assert.True(ActionHasAttribute<AllowAnonymousAttribute>(typeof(AuthController), "Login"));
    }

    // ── Version endpoint is public ──

    [Fact]
    public void VersionController_HasAllowAnonymous()
    {
        Assert.True(HasClassAttribute<VersionController, AllowAnonymousAttribute>());
    }

    // ── Live KPI endpoint is explicitly public ──

    [Fact]
    public void ReportsController_LiveSaleKpi_HasAllowAnonymous()
    {
        Assert.True(ActionHasAttribute<AllowAnonymousAttribute>(typeof(ReportsController), "GetLiveSaleKpi"));
    }

    // ── UsersController endpoints exist ──

    [Fact]
    public void UsersController_HasGetAllMethod()
    {
        var method = typeof(UsersController).GetMethod("GetAll");
        Assert.NotNull(method);
        Assert.True(method!.GetCustomAttribute<HttpGetAttribute>() is not null);
    }

    [Fact]
    public void UsersController_HasCreateMethod()
    {
        var method = typeof(UsersController).GetMethod("Create");
        Assert.NotNull(method);
        Assert.True(method!.GetCustomAttribute<HttpPostAttribute>() is not null);
    }

    [Fact]
    public void UsersController_HasDisableMethod()
    {
        var method = typeof(UsersController).GetMethod("Disable");
        Assert.NotNull(method);
    }

    [Fact]
    public void UsersController_HasResetPasswordMethod()
    {
        var method = typeof(UsersController).GetMethod("ResetPassword");
        Assert.NotNull(method);
    }

    [Fact]
    public void UsersController_HasAssignRolesMethod()
    {
        var method = typeof(UsersController).GetMethod("AssignRoles");
        Assert.NotNull(method);
    }
}
