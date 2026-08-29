using System.Security.Claims;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace HamptonHawksPlantSales.Api.Configuration;

/// <summary>
/// Re-checks the signed-in user on every request so that disabling a user or
/// changing their roles takes effect immediately instead of when the 12-hour
/// cookie finally expires. One cheap primary-key lookup per request.
/// </summary>
public static class CookiePrincipalValidator
{
    public static async Task ValidateAsync(CookieValidatePrincipalContext context)
    {
        var idString = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idString, out var userId))
        {
            await RejectAsync(context);
            return;
        }

        var users = context.HttpContext.RequestServices.GetRequiredService<IUserService>();
        var user = await users.GetByIdAsync(userId);

        if (user is null || !user.IsActive)
        {
            await RejectAsync(context);
            return;
        }

        // Roles in the cookie must match the roles on record; a mismatch means an
        // admin changed them, so force a fresh login rather than honouring stale claims.
        var cookieRoles = context.Principal!.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToArray();
        var currentRoles = user.Roles
            .Select(r => r.ToString())
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToArray();

        if (!cookieRoles.SequenceEqual(currentRoles, StringComparer.Ordinal))
            await RejectAsync(context);
    }

    private static async Task RejectAsync(CookieValidatePrincipalContext context)
    {
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
