using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class CreateOrderValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty().WithMessage("Customer is required.");

        // Lines are copied straight onto the entity, and outstanding commitments are
        // summed as QtyOrdered - QtyFulfilled: a zero or negative quantity would either
        // create an empty line or *reduce* commitments and inflate walk-up availability.
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.PlantCatalogId).NotEmpty().WithMessage("Plant is required for each line.");
            line.RuleFor(l => l.QtyOrdered).GreaterThan(0).WithMessage("Quantity ordered must be greater than zero.");
        });
    }
}
