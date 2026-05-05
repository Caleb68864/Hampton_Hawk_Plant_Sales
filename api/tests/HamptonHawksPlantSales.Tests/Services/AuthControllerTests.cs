using System.Security.Claims;
using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class AuthControllerTests
{
    private static UserResponse MakeUserResponse(Guid? id = null, AppRole[]? roles = null) =>
        new(
            id ?? Guid.NewGuid(),
            "alice",
            true,
            roles ?? [AppRole.Admin],
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow
        );

    private static AuthController MakeController(IUserService userService, bool authenticated = false, Guid? userId = null)
    {
        var controller = new AuthController(userService);

        var authServiceMock = new Mock<IAuthenticationService>();
        authServiceMock
            .Setup(a => a.SignInAsync(It.IsAny<HttpContext>(), It.IsAny<string>(), It.IsAny<ClaimsPrincipal>(), It.IsAny<AuthenticationProperties>()))
            .Returns(Task.CompletedTask);
        authServiceMock
            .Setup(a => a.SignOutAsync(It.IsAny<HttpContext>(), It.IsAny<string>(), It.IsAny<AuthenticationProperties?>()))
            .Returns(Task.CompletedTask);

        var services = new Mock<IServiceProvider>();
        services.Setup(s => s.GetService(typeof(IAuthenticationService))).Returns(authServiceMock.Object);

        var httpContext = new DefaultHttpContext { RequestServices = services.Object };

        if (authenticated && userId.HasValue)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId.Value.ToString()),
                new(ClaimTypes.Name, "alice"),
                new(ClaimTypes.Role, "Admin")
            };
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        }

        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        return controller;
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsSuccessEnvelopeWithUser()
    {
        var user = MakeUserResponse(roles: [AppRole.Admin]);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.ValidateCredentialsAsync("alice", "secret")).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.Login(new LoginRequest("alice", "secret"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<AuthUserResponse>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Equal("alice", envelope.Data!.Username);
        Assert.Contains("Admin", envelope.Data.Roles);
    }

    [Fact]
    public async Task Login_InvalidCredentials_ReturnsFailEnvelope()
    {
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.ValidateCredentialsAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync((UserResponse?)null);

        var controller = MakeController(mockService.Object);
        var result = await controller.Login(new LoginRequest("alice", "wrong"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<AuthUserResponse>>(ok.Value);
        Assert.False(envelope.Success);
        Assert.NotEmpty(envelope.Errors);
    }

    [Fact]
    public async Task Login_FailMessage_DoesNotRevealWhichConditionFailed()
    {
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.ValidateCredentialsAsync(It.IsAny<string>(), It.IsAny<string>())).ReturnsAsync((UserResponse?)null);

        var controller = MakeController(mockService.Object);
        var result = await controller.Login(new LoginRequest("nobody", "badpass"));

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<AuthUserResponse>>(ok.Value);
        Assert.False(envelope.Success);

        // Error must not say "user not found", "disabled", "wrong password" etc.
        var error = envelope.Errors.First().ToLowerInvariant();
        Assert.DoesNotContain("not found", error);
        Assert.DoesNotContain("disabled", error);
        Assert.DoesNotContain("wrong password", error);
    }

    [Fact]
    public async Task Logout_ReturnsSuccessEnvelope()
    {
        var mockService = new Mock<IUserService>();
        var userId = Guid.NewGuid();
        var controller = MakeController(mockService.Object, authenticated: true, userId: userId);

        var result = await controller.Logout();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.True(envelope.Success);
    }

    [Fact]
    public async Task Me_AuthenticatedUser_ReturnsUserEnvelope()
    {
        var userId = Guid.NewGuid();
        var user = MakeUserResponse(id: userId, roles: [AppRole.Admin]);

        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.GetByIdAsync(userId)).ReturnsAsync(user);

        var controller = MakeController(mockService.Object, authenticated: true, userId: userId);

        var result = await controller.Me();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<AuthUserResponse>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Equal("alice", envelope.Data!.Username);
    }

    [Fact]
    public async Task Me_UserNotFoundInDb_Returns401()
    {
        var userId = Guid.NewGuid();
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.GetByIdAsync(userId)).ReturnsAsync((UserResponse?)null);

        var controller = MakeController(mockService.Object, authenticated: true, userId: userId);

        var result = await controller.Me();

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(result.Result);
        var envelope = Assert.IsType<ApiResponse<AuthUserResponse>>(unauthorized.Value);
        Assert.False(envelope.Success);
    }
}
