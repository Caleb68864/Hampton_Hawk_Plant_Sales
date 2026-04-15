using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public sealed class CanonicalOrdersAdapter : ImportFormatAdapterBase
{
    public override ImportType Type => ImportType.Orders;
    public override string Name => "CanonicalOrders";
    public override bool IsCanonical => true;
    public override IReadOnlyList<string> RequiredHeaders { get; } = new[] { "OrderNumber", "Sku", "QtyOrdered" };

    public override Dictionary<string, string> Map(Dictionary<string, string> rawRow)
    {
        // Pass-through: canonical rows already match the handler's expected schema.
        return new Dictionary<string, string>(rawRow, StringComparer.OrdinalIgnoreCase);
    }
}
