using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class UpdateInventoryValidator : AbstractValidator<UpdateInventoryRequest>
{
    public UpdateInventoryValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Reason is required.");
        RuleFor(x => x.OnHandQty).GreaterThanOrEqualTo(0).WithMessage("On-hand quantity must be non-negative.");
    }
}

public class AdjustInventoryValidator : AbstractValidator<AdjustInventoryRequest>
{
    public AdjustInventoryValidator()
    {
        RuleFor(x => x.PlantId).NotEmpty().WithMessage("Plant ID is required.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Reason is required.");
        RuleFor(x => x.DeltaQty).NotEqual(0).WithMessage("Delta quantity must not be zero.");
    }
}
