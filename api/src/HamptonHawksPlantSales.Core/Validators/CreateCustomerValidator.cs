using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class CreateCustomerValidator : AbstractValidator<CreateCustomerRequest>
{
    public CreateCustomerValidator()
    {
        RuleFor(x => x.DisplayName).NotEmpty().WithMessage("Display name is required.");
    }
}
