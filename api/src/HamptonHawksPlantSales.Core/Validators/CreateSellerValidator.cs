using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class CreateSellerValidator : AbstractValidator<CreateSellerRequest>
{
    public CreateSellerValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().WithMessage("Display name is required.");
    }
}
