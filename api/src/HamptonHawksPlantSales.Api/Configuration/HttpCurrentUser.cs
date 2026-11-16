using System.Security.Claims;
using HamptonHawksPlantSales.Core.Interfaces;

namespace HamptonHawksPlantSales.Api.Configuration;

/// <summary>Reads the signed-in user's id from the auth cookie's NameIdentifier claim.</summary>
public sealed class HttpCurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public HttpCurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    public Guid? UserId =>
        Guid.TryParse(_accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : null;
}
