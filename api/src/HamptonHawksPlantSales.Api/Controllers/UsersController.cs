using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Policy = "AdminOnly")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<UserResponse>>), 200)]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllAsync();
        return Ok(ApiResponse<IEnumerable<UserResponse>>.Ok(users));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), 200)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);
        if (user is null)
            return Ok(ApiResponse<UserResponse>.Fail("User not found."));
        return Ok(ApiResponse<UserResponse>.Ok(user));
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), 200)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        try
        {
            var user = await _userService.CreateAsync(request);
            return Ok(ApiResponse<UserResponse>.Ok(user));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(ApiResponse<UserResponse>.Fail(ex.Message));
        }
    }

    [HttpPut("{id:guid}/disable")]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), 200)]
    public async Task<IActionResult> Disable(Guid id)
    {
        try
        {
            var user = await _userService.DisableAsync(id);
            return Ok(ApiResponse<UserResponse>.Ok(user));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(ApiResponse<UserResponse>.Fail(ex.Message));
        }
    }

    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), 200)]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request)
    {
        try
        {
            var user = await _userService.ResetPasswordAsync(id, request.NewPassword);
            return Ok(ApiResponse<UserResponse>.Ok(user));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(ApiResponse<UserResponse>.Fail(ex.Message));
        }
    }

    [HttpPut("{id:guid}/roles")]
    [ProducesResponseType(typeof(ApiResponse<UserResponse>), 200)]
    public async Task<IActionResult> AssignRoles(Guid id, [FromBody] AssignRolesRequest request)
    {
        try
        {
            var user = await _userService.AssignRolesAsync(id, request.Roles);
            return Ok(ApiResponse<UserResponse>.Ok(user));
        }
        catch (InvalidOperationException ex)
        {
            return Ok(ApiResponse<UserResponse>.Fail(ex.Message));
        }
    }
}
