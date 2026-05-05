using System.Security.Claims;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HamptonHawksPlantSales.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;

    public AuthController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AuthUserResponse>>> Login([FromBody] LoginRequest request)
    {
        var user = await _userService.ValidateCredentialsAsync(request.Username, request.Password);

        if (user is null)
            return Ok(ApiResponse<AuthUserResponse>.Fail("Invalid credentials."));

        var roleStrings = user.Roles.Select(r => r.ToString()).ToList();

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username)
        };
        claims.AddRange(roleStrings.Select(r => new Claim(ClaimTypes.Role, r)));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, new AuthenticationProperties
        {
            IsPersistent = false
        });

        var response = new AuthUserResponse(user.Id, user.Username, user.IsActive, roleStrings);
        return Ok(ApiResponse<AuthUserResponse>.Ok(response));
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<object>>> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(ApiResponse<object>.Ok(null!));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AuthUserResponse>>> Me()
    {
        var idString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idString is null || !Guid.TryParse(idString, out var id))
            return Unauthorized(ApiResponse<AuthUserResponse>.Fail("Not authenticated."));

        var user = await _userService.GetByIdAsync(id);
        if (user is null)
            return Unauthorized(ApiResponse<AuthUserResponse>.Fail("User not found."));

        var roleStrings = user.Roles.Select(r => r.ToString()).ToList();
        var response = new AuthUserResponse(user.Id, user.Username, user.IsActive, roleStrings);
        return Ok(ApiResponse<AuthUserResponse>.Ok(response));
    }
}
