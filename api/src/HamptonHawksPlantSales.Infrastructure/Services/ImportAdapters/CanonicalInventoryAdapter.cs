using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public sealed class CanonicalInventoryAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Inventory;
    public override string Name => "CanonicalInventory";
    public override bool IsCanonical => true;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "Sku", "OnHandQty" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        return new Dictionary<string, string>(rawRow, StringComparer.OrdinalIgnoreCase);
    }
}
