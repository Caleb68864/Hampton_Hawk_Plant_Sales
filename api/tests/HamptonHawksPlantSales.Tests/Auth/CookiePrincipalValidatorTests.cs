using System.Security.Claims;
using FluentAssertions;
using HamptonHawksPlantSales.Api.Configuration;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Moq;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// Disabling a user or changing their roles must take effect on the next request,
/// not when the 12-hour cookie expires.
/// </summary>
public class CookiePrincipalValidatorTests
{
    private static UserResponse User(Guid id, bool isActive, params AppRole[] roles) =>
        new(id, "vol", isActive, roles, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

    private static (CookieValidatePrincipalContext Context, Mock<IAuthenticationService> Auth) BuildContext(
        Guid userId, UserResponse? current, params string[] cookieRoles)
    {
        var users = new Mock<IUserService>();
        users.Setup(u => u.GetByIdAsync(userId)).ReturnsAsync(current);

        var auth = new Mock<IAuthenticationService>();
        auth.Setup(a => a.SignOutAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()))
            .Returns(Task.CompletedTask);

        var services = new Mock<IServiceProvider>();
        services.Setup(s => s.GetService(typeof(IUserService))).Returns(users.Object);
        services.Setup(s => s.GetService(typeof(IAuthenticationService))).Returns(auth.Object);

        var httpContext = new DefaultHttpContext { RequestServices = services.Object };

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()), new(ClaimTypes.Name, "vol") };
        claims.AddRange(cookieRoles.Select(r => new Claim(ClaimTypes.Role, r)));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        var ticket = new AuthenticationTicket(principal, CookieAuthenticationDefaults.AuthenticationScheme);
        var scheme = new AuthenticationScheme(CookieAuthenticationDefaults.AuthenticationScheme, null, typeof(CookieAuthenticationHandler));

        return (new CookieValidatePrincipalContext(httpContext, scheme, new CookieAuthenticationOptions(), ticket), auth);
    }

    [Fact]
    public async Task ActiveUserWithMatchingRoles_IsAccepted()
    {
        var id = Guid.NewGuid();
        var (ctx, auth) = BuildContext(id, User(id, true, AppRole.Admin, AppRole.Pickup), "Pickup", "Admin");

        await CookiePrincipalValidator.ValidateAsync(ctx);

        ctx.Principal.Should().NotBeNull();
        auth.Verify(a => a.SignOutAsync(It.IsAny<HttpContext>(), It.IsAny<string?>(), It.IsAny<AuthenticationProperties?>()), Times.Never);
    }

    [Fact]
    public async Task DisabledUser_IsRejectedAndSignedOut()
    {
        var id = Guid.NewGuid();
        var (ctx, auth) = BuildContext(id, User(id, false, AppRole.Admin), "Admin");

        await CookiePrincipalValidator.ValidateAsync(ctx);

        ctx.Principal.Should().BeNull();
        auth.Verify(a => a.SignOutAsync(It.IsAny<HttpContext>(), CookieAuthenticationDefaults.AuthenticationScheme, It.IsAny<AuthenticationProperties?>()), Times.Once);
    }

    [Fact]
    public async Task DeletedUser_IsRejected()
    {
        var id = Guid.NewGuid();
        var (ctx, _) = BuildContext(id, null, "Admin");

        await CookiePrincipalValidator.ValidateAsync(ctx);

        ctx.Principal.Should().BeNull();
    }

    [Fact]
    public async Task RoleChange_IsRejectedSoTheClientReLogsIn()
    {
        var id = Guid.NewGuid();
        var (ctx, _) = BuildContext(id, User(id, true, AppRole.Pickup), "Admin");

        await CookiePrincipalValidator.ValidateAsync(ctx);

        ctx.Principal.Should().BeNull();
    }

    [Fact]
    public async Task MissingIdClaim_IsRejected()
    {
        var (ctx, _) = BuildContext(Guid.NewGuid(), null);
        var stripped = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "x") }, "Cookies"));
        ctx.ReplacePrincipal(stripped);

        await CookiePrincipalValidator.ValidateAsync(ctx);

        ctx.Principal.Should().BeNull();
    }
}
