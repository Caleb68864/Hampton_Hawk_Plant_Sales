using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty().WithMessage("Customer is required.");
    }
}
