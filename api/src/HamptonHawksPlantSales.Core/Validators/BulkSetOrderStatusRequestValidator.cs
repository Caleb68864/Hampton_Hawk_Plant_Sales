using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Validators;

public class BulkSetOrderStatusRequestValidator : AbstractValidator<BulkSetOrderStatusRequest>
{
    public BulkSetOrderStatusRequestValidator()
    {
        RuleFor(x => x.OrderIds)
            .NotEmpty().WithMessage("OrderIds is required.")
            .Must(ids => ids != null && ids.Count <= 500)
            .WithMessage("OrderIds cannot exceed 500 items.");

        RuleFor(x => x.TargetStatus)
            .IsInEnum().WithMessage("TargetStatus must be a valid OrderStatus.");
    }
}
