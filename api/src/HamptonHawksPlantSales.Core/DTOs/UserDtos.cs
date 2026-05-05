using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public record ResetPasswordRequest(string NewPassword);

public record AssignRolesRequest(IEnumerable<AppRole> Roles);
