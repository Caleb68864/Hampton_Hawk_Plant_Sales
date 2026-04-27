using FluentAssertions;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Validators;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Settings;

public class ScannerTuningTests
{
    // ── SS-01: Scanner Tuning Settings Tests ──

    [Fact]
    public async Task UpdateScannerTuning_PersistsValues()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new SettingsService(db);

        var request = new UpdateScannerTuningRequest
        {
            PickupSearchDebounceMs = 200,
            PickupAutoJumpMode = PickupAutoJumpMode.ExactMatchOnly,
            PickupMultiScanEnabled = false
        };

        // Act
        var result = await service.UpdateScannerTuningAsync(request, "Testing scanner tuning");

        // Assert: returned response reflects the updated values
        result.PickupSearchDebounceMs.Should().Be(200);
        result.PickupAutoJumpMode.Should().Be(PickupAutoJumpMode.ExactMatchOnly);
        result.PickupMultiScanEnabled.Should().BeFalse();

        // Assert: values are persisted to the database
        var settings = await db.AppSettings.FirstAsync();
        settings.PickupSearchDebounceMs.Should().Be(200);
        settings.PickupAutoJumpMode.Should().Be(PickupAutoJumpMode.ExactMatchOnly);
        settings.PickupMultiScanEnabled.Should().BeFalse();

        // Assert: AdminAction was logged
        var adminAction = await db.AdminActions.FirstOrDefaultAsync(a => a.ActionType == "UpdateScannerTuning");
        adminAction.Should().NotBeNull();
        adminAction!.Reason.Should().Be("Testing scanner tuning");
    }

    [Fact]
    public async Task UpdateScannerTuning_PartialUpdate_OnlyUpdatesProvidedFields()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new SettingsService(db);

        // Get default values first
        var initial = await service.GetSettingsAsync();
        var initialDebounce = initial.PickupSearchDebounceMs;
        var initialAutoJump = initial.PickupAutoJumpMode;

        // Only update PickupMultiScanEnabled
        var request = new UpdateScannerTuningRequest
        {
            PickupMultiScanEnabled = false
        };

        // Act
        var result = await service.UpdateScannerTuningAsync(request, "Partial update test");

        // Assert: only PickupMultiScanEnabled changed
        result.PickupSearchDebounceMs.Should().Be(initialDebounce);
        result.PickupAutoJumpMode.Should().Be(initialAutoJump);
        result.PickupMultiScanEnabled.Should().BeFalse();
    }

    [Fact]
    public async Task GetSettingsAsync_ReturnsDefaultScannerTuningValues()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new SettingsService(db);

        // Act
        var result = await service.GetSettingsAsync();

        // Assert: default values from the model
        result.PickupSearchDebounceMs.Should().Be(120);
        result.PickupAutoJumpMode.Should().Be(PickupAutoJumpMode.BestMatchWhenSingle);
        result.PickupMultiScanEnabled.Should().BeTrue();
    }

    // ── Validation Tests ──

    [Fact]
    public void Validator_RejectsDebounceOutOfRange_TooLow()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest { PickupSearchDebounceMs = 10 };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PickupSearchDebounceMs");
    }

    [Fact]
    public void Validator_RejectsDebounceOutOfRange_TooHigh()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest { PickupSearchDebounceMs = 600 };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PickupSearchDebounceMs");
    }

    [Theory]
    [InlineData(50)]  // Lower bound
    [InlineData(120)] // Default
    [InlineData(500)] // Upper bound
    public void Validator_AcceptsValidDebounceValues(int debounceMs)
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest { PickupSearchDebounceMs = debounceMs };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_AcceptsEmptyRequest()
    {
        // Arrange: all fields null is valid (no-op update)
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest();

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_AcceptsValidEnumValue()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest
        {
            PickupAutoJumpMode = PickupAutoJumpMode.ExactMatchOnly
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_RejectsInvalidEnumValue()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest
        {
            PickupAutoJumpMode = (PickupAutoJumpMode)999
        };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PickupAutoJumpMode");
    }

    [Fact]
    public void Validator_AcceptsValidBooleanValue()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest { PickupMultiScanEnabled = false };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validator_ReturnsDescriptiveErrorMessage()
    {
        // Arrange
        var validator = new UpdateScannerTuningRequestValidator();
        var request = new UpdateScannerTuningRequest { PickupSearchDebounceMs = 10 };

        // Act
        var result = validator.Validate(request);

        // Assert
        result.Errors.Should().ContainSingle()
            .Which.ErrorMessage.Should().Contain("50").And.Contain("500");
    }
}
