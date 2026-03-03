using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface ISettingsService
{
    Task<SettingsResponse> GetSettingsAsync();
    Task<SettingsResponse> ToggleSaleClosedAsync(bool saleClosed, string? reason);
}
