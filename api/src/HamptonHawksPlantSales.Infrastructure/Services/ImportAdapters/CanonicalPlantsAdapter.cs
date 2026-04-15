using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public sealed class CanonicalPlantsAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Plants;
    public override string Name => "CanonicalPlants";
    public override bool IsCanonical => true;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "Sku", "Name", "Barcode" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        return new Dictionary<string, string>(rawRow, StringComparer.OrdinalIgnoreCase);
    }
}
