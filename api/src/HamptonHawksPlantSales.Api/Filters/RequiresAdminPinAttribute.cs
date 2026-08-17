using Microsoft.AspNetCore.Mvc.Filters;

namespace HamptonHawksPlantSales.Api.Filters;

/// <summary>
/// Marks an action as requiring the X-Admin-Pin / X-Admin-Reason headers.
/// Enforced by <see cref="AdminPinActionFilter"/>, which matches on this exact type --
/// keep it the only RequiresAdminPinAttribute in the project.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequiresAdminPinAttribute : Attribute, IFilterMetadata
{
}
