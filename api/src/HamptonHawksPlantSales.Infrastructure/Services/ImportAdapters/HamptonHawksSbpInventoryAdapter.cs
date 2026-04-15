using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

// Maps the "Sales by Product with flat totals.xlsx" shape to canonical inventory rows.
// Source columns: Plant Name, Item number, Price, # per flat, Total Units, Total Sales.
// Total Units becomes OnHandQty; everything else is ignored.
public sealed class HamptonHawksSbpInventoryAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Inventory;
    public override string Name => "HamptonHawksSbpInventory";
    public override bool IsCanonical => false;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "Item number", "Total Units" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        var sku = GetTrimmed(rawRow, "Item number");
        var totalUnits = GetTrimmed(rawRow, "Total Units");

        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Sku"] = sku,
            ["OnHandQty"] = totalUnits
        };
    }
}
