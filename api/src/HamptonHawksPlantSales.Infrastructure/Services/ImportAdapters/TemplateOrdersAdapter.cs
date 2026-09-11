using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

/// <summary>
/// Matches the downloadable orders template the Imports page advertises
/// (<c>CustomerDisplayName, SellerDisplayName, PlantSKU, Qty, Notes</c>).
/// Rows carry no order number; the handler groups a customer's rows into one
/// order and assigns the next free number.
/// </summary>
public sealed class TemplateOrdersAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Orders;
    public override string Name => "TemplateOrders";
    public override bool IsCanonical => false;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "CustomerDisplayName", "PlantSKU", "Qty" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["OrderNumber"] = GetTrimmed(rawRow, "OrderNumber"),
            ["CustomerDisplayName"] = GetTrimmed(rawRow, "CustomerDisplayName"),
            ["Phone"] = GetTrimmed(rawRow, "Phone"),
            ["Email"] = GetTrimmed(rawRow, "Email"),
            ["PickupCode"] = GetTrimmed(rawRow, "PickupCode"),
            ["SellerDisplayName"] = GetTrimmed(rawRow, "SellerDisplayName"),
            ["Sku"] = GetTrimmed(rawRow, "PlantSKU"),
            ["QtyOrdered"] = GetTrimmed(rawRow, "Qty"),
            ["Notes"] = GetTrimmed(rawRow, "Notes"),
            ["IsWalkUp"] = "false"
        };
    }
}
