using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Validators;

public class UpdateScannerTuningRequestValidator : AbstractValidator<UpdateScannerTuningRequest>
{
    public UpdateScannerTuningRequestValidator()
    {
        RuleFor(x => x.PickupSearchDebounceMs)
            .InclusiveBetween(50, 500)
            .When(x => x.PickupSearchDebounceMs.HasValue)
            .WithMessage("PickupSearchDebounceMs must be between 50 and 500 milliseconds.");

        RuleFor(x => x.PickupAutoJumpMode)
            .IsInEnum()
            .When(x => x.PickupAutoJumpMode.HasValue)
            .WithMessage("PickupAutoJumpMode must be a valid enum value.");

        RuleFor(x => x.PickupMultiScanEnabled)
            .NotNull()
            .When(x => x.PickupMultiScanEnabled.HasValue)
            .WithMessage("PickupMultiScanEnabled must be a valid boolean value.");
    }
}
