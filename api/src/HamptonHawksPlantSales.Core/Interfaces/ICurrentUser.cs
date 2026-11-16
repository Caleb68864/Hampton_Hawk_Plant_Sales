namespace HamptonHawksPlantSales.Core.Interfaces;

/// <summary>
/// The signed-in account making the current request, for audit attribution. Sale-day
/// accounts are per station (Pickup1, POS2, ...), so this identifies the station login.
/// </summary>
public interface ICurrentUser
{
    /// <summary>The <c>AppUser.Id</c>, or null outside an authenticated request.</summary>
    Guid? UserId { get; }
}
