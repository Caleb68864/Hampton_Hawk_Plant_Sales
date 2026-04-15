using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public sealed class HamptonHawks2026OrdersAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Orders;
    public override string Name => "HamptonHawks2026Orders";
    public override bool IsCanonical => false;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "Order #", "Name", "Item #", "Qnty" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        var orderNumber = GetTrimmed(rawRow, "Order #");
        var name = GetTrimmed(rawRow, "Name");
        var phone = GetTrimmed(rawRow, "Phone");
        var email = GetTrimmed(rawRow, "Email");
        var seller = GetTrimmed(rawRow, "Seller");
        var sku = GetTrimmed(rawRow, "Item #");
        var qty = GetTrimmed(rawRow, "Qnty");

        var (customerFirst, customerLast) = SplitOnFirstSpace(name);
        var (sellerFirst, sellerLast) = SplitOnFirstSpace(seller);

        var canonical = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["OrderNumber"] = orderNumber,
            ["CustomerDisplayName"] = name,
            ["CustomerFirstName"] = customerFirst,
            ["CustomerLastName"] = customerLast,
            ["Phone"] = phone,
            ["Email"] = email,
            ["SellerDisplayName"] = seller,
            ["SellerFirstName"] = sellerFirst,
            ["SellerLastName"] = sellerLast,
            ["Sku"] = sku,
            ["QtyOrdered"] = qty,
            ["IsWalkUp"] = "false"
        };

        return canonical;
    }

    private static (string first, string last) SplitOnFirstSpace(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return (string.Empty, string.Empty);
        }

        var trimmed = value.Trim();
        var idx = trimmed.IndexOf(' ');
        if (idx < 0)
        {
            return (trimmed, string.Empty);
        }

        var first = trimmed[..idx].Trim();
        var last = trimmed[(idx + 1)..].Trim();
        return (first, last);
    }
}
