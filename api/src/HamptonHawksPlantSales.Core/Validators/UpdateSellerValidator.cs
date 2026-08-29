using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class UpdateSellerValidator : AbstractValidator<UpdateSellerRequest>
{
    public UpdateSellerValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().WithMessage("Display name is required.");
    }
}
