using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class ScanIntoDraftRequestValidator : AbstractValidator<ScanIntoDraftRequest>
{
    public ScanIntoDraftRequestValidator()
    {
        RuleFor(x => x.PlantBarcode).NotEmpty().WithMessage("PlantBarcode is required.");
        RuleFor(x => x.ScanId).NotEmpty().WithMessage("ScanId is required.");
    }
}

public class AdjustLineRequestValidator : AbstractValidator<AdjustLineRequest>
{
    public AdjustLineRequestValidator()
    {
        RuleFor(x => x.PlantCatalogId).NotEmpty().WithMessage("PlantCatalogId is required.");
        RuleFor(x => x.NewQty).GreaterThanOrEqualTo(0).WithMessage("NewQty must be zero or greater.");
    }
}

public class CloseDraftRequestValidator : AbstractValidator<CloseDraftRequest>
{
    public CloseDraftRequestValidator()
    {
        RuleFor(x => x.AmountTendered)
            .GreaterThanOrEqualTo(0)
            .When(x => x.AmountTendered.HasValue)
            .WithMessage("AmountTendered must be zero or greater.");
    }
}
