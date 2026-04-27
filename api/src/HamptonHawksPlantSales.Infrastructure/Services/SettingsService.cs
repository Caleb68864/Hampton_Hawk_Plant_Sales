using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class SettingsService : ISettingsService
{
    private readonly AppDbContext _db;

    public SettingsService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<SettingsResponse> GetSettingsAsync()
    {
        var settings = await _db.AppSettings.FirstAsync();
        return MapToResponse(settings);
    }

    public async Task<SettingsResponse> ToggleSaleClosedAsync(bool saleClosed, string? reason)
    {
        var settings = await _db.AppSettings.FirstAsync();

        settings.SaleClosed = saleClosed;
        settings.SaleClosedAt = saleClosed ? DateTimeOffset.UtcNow : null;

        _db.AdminActions.Add(new AdminAction
        {
            ActionType = "ToggleSaleClosed",
            EntityType = "AppSettings",
            EntityId = settings.Id,
            Reason = reason ?? string.Empty,
            Message = saleClosed ? "Sale closed" : "Sale opened"
        });

        await _db.SaveChangesAsync();

        return MapToResponse(settings);
    }

    public async Task<SettingsResponse> UpdateScannerTuningAsync(UpdateScannerTuningRequest request, string? reason)
    {
        var settings = await _db.AppSettings.FirstAsync();

        // Only update fields that are provided
        if (request.PickupSearchDebounceMs.HasValue)
        {
            settings.PickupSearchDebounceMs = request.PickupSearchDebounceMs.Value;
        }

        if (request.PickupAutoJumpMode.HasValue)
        {
            settings.PickupAutoJumpMode = request.PickupAutoJumpMode.Value;
        }

        if (request.PickupMultiScanEnabled.HasValue)
        {
            settings.PickupMultiScanEnabled = request.PickupMultiScanEnabled.Value;
        }

        _db.AdminActions.Add(new AdminAction
        {
            ActionType = "UpdateScannerTuning",
            EntityType = "AppSettings",
            EntityId = settings.Id,
            Reason = reason ?? string.Empty,
            Message = $"Scanner tuning updated: DebounceMs={settings.PickupSearchDebounceMs}, AutoJumpMode={settings.PickupAutoJumpMode}, MultiScanEnabled={settings.PickupMultiScanEnabled}"
        });

        await _db.SaveChangesAsync();

        return MapToResponse(settings);
    }

    private static SettingsResponse MapToResponse(AppSettings s) => new()
    {
        SaleClosed = s.SaleClosed,
        SaleClosedAt = s.SaleClosedAt,
        PickupSearchDebounceMs = s.PickupSearchDebounceMs,
        PickupAutoJumpMode = s.PickupAutoJumpMode,
        PickupMultiScanEnabled = s.PickupMultiScanEnabled
    };
}
