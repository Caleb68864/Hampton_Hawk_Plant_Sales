using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class CreatePlantValidator : AbstractValidator<CreatePlantRequest>
{
    public CreatePlantValidator()
    {
        RuleFor(x => x.Sku).NotEmpty().WithMessage("SKU is required.");
        RuleFor(x => x.Barcode).NotEmpty().WithMessage("Barcode is required.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).When(x => x.Price.HasValue)
            .WithMessage("Price must be non-negative.");
    }
}
