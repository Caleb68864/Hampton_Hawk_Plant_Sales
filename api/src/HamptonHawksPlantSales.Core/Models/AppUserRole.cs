using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class AppUserRole
{
    public Guid AppUserId { get; set; }
    public AppRole Role { get; set; }

    public AppUser User { get; set; } = null!;
}
