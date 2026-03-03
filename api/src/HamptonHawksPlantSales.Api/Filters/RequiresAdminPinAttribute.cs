using Microsoft.AspNetCore.Mvc.Filters;

namespace HamptonHawksPlantSales.Api.Filters;

/// <summary>
/// Placeholder attribute for admin PIN verification.
/// The actual AdminPinActionFilter is provided by sub-spec 4.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequiresAdminPinAttribute : Attribute, IFilterMetadata
{
}
