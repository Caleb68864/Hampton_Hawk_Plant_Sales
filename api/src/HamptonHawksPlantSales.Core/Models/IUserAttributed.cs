namespace HamptonHawksPlantSales.Core.Models;

/// <summary>
/// An event row that records which signed-in account caused it. AppDbContext
/// stamps <see cref="UserId"/> from ICurrentUser on insert when the caller has
/// not set it. Nullable with no foreign key, so the row outlives the account;
/// sale-day logins are per station, so this names the station login.
/// </summary>
public interface IUserAttributed
{
    Guid? UserId { get; set; }
}
