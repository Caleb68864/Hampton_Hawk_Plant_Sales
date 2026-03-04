using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Services;

public class SettingsServiceTests
{
    // ── EP-51: Get Application Settings ──

    [Fact]
    public async Task GetSettingsAsync_DefaultState_ReturnsSaleClosedFalse()
    {
        // Arrange: AppDbContext seeds an AppSettings row automatically via HasData
        using var db = MockDbContextFactory.Create();
        var service = new SettingsService(db);

        // Act
        var result = await service.GetSettingsAsync();

        // Assert: seeded row has SaleClosed=false
        result.SaleClosed.Should().BeFalse();
        result.SaleClosedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetSettingsAsync_SaleClosedTrue_ReturnsSaleClosedWithTimestamp()
    {
        // Arrange: update the seeded AppSettings row to SaleClosed=true
        using var db = MockDbContextFactory.Create();
        var settings = await db.AppSettings.FirstAsync();
        settings.SaleClosed = true;
        settings.SaleClosedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();

        var service = new SettingsService(db);

        // Act
        var result = await service.GetSettingsAsync();

        // Assert
        result.SaleClosed.Should().BeTrue();
        result.SaleClosedAt.Should().NotBeNull();
        result.SaleClosedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task GetSettingsAsync_AfterToggle_ReflectsUpdatedState()
    {
        // Arrange: seeded row has SaleClosed=false
        using var db = MockDbContextFactory.Create();
        var service = new SettingsService(db);

        // Verify default state
        var defaultResult = await service.GetSettingsAsync();
        defaultResult.SaleClosed.Should().BeFalse();
        defaultResult.SaleClosedAt.Should().BeNull();

        // Act: toggle sale closed
        await service.ToggleSaleClosedAsync(true, "End of day closing");

        // Assert: settings now reflect closed state
        var updatedResult = await service.GetSettingsAsync();
        updatedResult.SaleClosed.Should().BeTrue();
        updatedResult.SaleClosedAt.Should().NotBeNull();
    }
}
