using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public sealed class HamptonHawksR1PlantsAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Plants;
    public override string Name => "HamptonHawksR1Plants";
    public override bool IsCanonical => false;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "Plant Name", "Item number", "Price" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        var plantName = GetTrimmed(rawRow, "Plant Name");
        var sku = GetTrimmed(rawRow, "Item number");
        var price = GetTrimmed(rawRow, "Price");

        var barcode = string.IsNullOrWhiteSpace(sku)
            ? string.Empty
            : "HH" + sku.PadLeft(12, '0');

        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Sku"] = sku,
            ["Name"] = plantName,
            ["Price"] = price,
            ["Barcode"] = barcode,
            ["IsActive"] = "true"
        };
    }
}
