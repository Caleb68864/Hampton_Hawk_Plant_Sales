using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class AppUser : BaseEntity
{
    public string Username { get; set; } = "";
    public string NormalizedUsername { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsActive { get; set; } = true;

    public ICollection<AppUserRole> Roles { get; set; } = new List<AppUserRole>();
}
