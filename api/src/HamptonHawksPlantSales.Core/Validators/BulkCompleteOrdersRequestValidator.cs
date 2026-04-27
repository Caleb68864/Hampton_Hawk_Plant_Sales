using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class BulkCompleteOrdersRequestValidator : AbstractValidator<BulkCompleteOrdersRequest>
{
    public BulkCompleteOrdersRequestValidator()
    {
        RuleFor(x => x.OrderIds)
            .NotEmpty().WithMessage("OrderIds is required.")
            .Must(ids => ids != null && ids.Count <= 500)
            .WithMessage("OrderIds cannot exceed 500 items.");
    }
}
