using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class UpdatePlantValidator : AbstractValidator<UpdatePlantRequest>
{
    public UpdatePlantValidator()
    {
        RuleFor(x => x.Sku).NotEmpty().WithMessage("SKU is required.");
        RuleFor(x => x.Barcode).NotEmpty().WithMessage("Barcode is required.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).When(x => x.Price.HasValue)
            .WithMessage("Price must be non-negative.");
        // PlantCatalogs.Price is numeric(10,2): a larger value overflowed in Postgres
        // (a 500), and a third decimal was rounded on save while the response
        // echoed the unrounded value.
        RuleFor(x => x.Price!.Value).PrecisionScale(10, 2, true).When(x => x.Price.HasValue)
            .WithMessage("Price must be at most 99,999,999.99 with no more than 2 decimal places.");
    }
}
