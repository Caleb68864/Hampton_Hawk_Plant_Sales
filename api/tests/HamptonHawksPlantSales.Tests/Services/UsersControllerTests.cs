using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class UsersControllerTests
{
    private static UserResponse MakeUser(Guid? id = null, bool isActive = true, AppRole[]? roles = null) =>
        new(
            id ?? Guid.NewGuid(),
            "testuser",
            isActive,
            roles ?? [AppRole.Admin],
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow
        );

    private static UsersController MakeController(IUserService userService)
    {
        var controller = new UsersController(userService);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    [Fact]
    public async Task GetAll_ReturnsSuccessEnvelopeWithUsers()
    {
        var users = new[] { MakeUser(), MakeUser() };
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.GetAllAsync()).ReturnsAsync(users);

        var controller = MakeController(mockService.Object);
        var result = await controller.GetAll();

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<IEnumerable<UserResponse>>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Equal(2, envelope.Data!.Count());
    }

    [Fact]
    public async Task GetById_ExistingUser_ReturnsSuccessEnvelope()
    {
        var userId = Guid.NewGuid();
        var user = MakeUser(id: userId);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.GetByIdAsync(userId)).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.GetById(userId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Equal(userId, envelope.Data!.Id);
    }

    [Fact]
    public async Task GetById_NotFound_ReturnsFailEnvelope()
    {
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((UserResponse?)null);

        var controller = MakeController(mockService.Object);
        var result = await controller.GetById(Guid.NewGuid());

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.False(envelope.Success);
    }

    [Fact]
    public async Task Create_ValidRequest_ReturnsSuccessEnvelope()
    {
        var user = MakeUser(roles: [AppRole.POS]);
        var request = new CreateUserRequest("newuser", "password123", [AppRole.POS]);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.CreateAsync(request)).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.Create(request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.True(envelope.Success);
    }

    [Fact]
    public async Task Create_DuplicateUsername_ReturnsFailEnvelope()
    {
        var request = new CreateUserRequest("existinguser", "password123", [AppRole.POS]);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.CreateAsync(request))
            .ThrowsAsync(new InvalidOperationException("Username 'existinguser' is already taken."));

        var controller = MakeController(mockService.Object);
        var result = await controller.Create(request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.False(envelope.Success);
    }

    [Fact]
    public async Task Disable_ValidUser_ReturnsSuccessEnvelope()
    {
        var userId = Guid.NewGuid();
        var user = MakeUser(id: userId, isActive: false);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.DisableAsync(userId)).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.Disable(userId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.False(envelope.Data!.IsActive);
    }

    [Fact]
    public async Task Disable_LastAdmin_ReturnsFailEnvelope()
    {
        var userId = Guid.NewGuid();
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.DisableAsync(userId))
            .ThrowsAsync(new InvalidOperationException("Cannot disable the last active admin user."));

        var controller = MakeController(mockService.Object);
        var result = await controller.Disable(userId);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.False(envelope.Success);
        Assert.Contains("last active admin", envelope.Errors.First());
    }

    [Fact]
    public async Task ResetPassword_ValidUser_ReturnsSuccessEnvelope()
    {
        var userId = Guid.NewGuid();
        var user = MakeUser(id: userId);
        var request = new ResetPasswordRequest("newpassword123");
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.ResetPasswordAsync(userId, "newpassword123")).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.ResetPassword(userId, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.True(envelope.Success);
    }

    [Fact]
    public async Task ResetPassword_UserNotFound_ReturnsFailEnvelope()
    {
        var userId = Guid.NewGuid();
        var request = new ResetPasswordRequest("newpassword123");
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.ResetPasswordAsync(userId, It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException($"User {userId} not found."));

        var controller = MakeController(mockService.Object);
        var result = await controller.ResetPassword(userId, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.False(envelope.Success);
    }

    [Fact]
    public async Task AssignRoles_ValidRequest_ReturnsSuccessEnvelope()
    {
        var userId = Guid.NewGuid();
        var roles = new[] { AppRole.Reports };
        var user = MakeUser(id: userId, roles: roles);
        var request = new AssignRolesRequest(roles);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.AssignRolesAsync(userId, roles)).ReturnsAsync(user);

        var controller = MakeController(mockService.Object);
        var result = await controller.AssignRoles(userId, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.True(envelope.Success);
    }

    [Fact]
    public async Task AssignRoles_RemovingLastAdminRole_ReturnsFailEnvelope()
    {
        var userId = Guid.NewGuid();
        var request = new AssignRolesRequest([AppRole.POS]);
        var mockService = new Mock<IUserService>();
        mockService.Setup(s => s.AssignRolesAsync(userId, It.IsAny<IEnumerable<AppRole>>()))
            .ThrowsAsync(new InvalidOperationException("Cannot remove Admin role from the last active admin user."));

        var controller = MakeController(mockService.Object);
        var result = await controller.AssignRoles(userId, request);

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<UserResponse>>(ok.Value);
        Assert.False(envelope.Success);
    }
}
