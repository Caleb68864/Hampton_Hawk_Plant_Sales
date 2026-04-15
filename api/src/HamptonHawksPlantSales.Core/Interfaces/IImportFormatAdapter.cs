using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Interfaces;

/// <summary>
/// Translates a raw row (keyed by source header) into the canonical row shape
/// consumed by the import handlers. Implementations are stateless.
/// </summary>
public interface IImportFormatAdapter
{
    ImportType Type { get; }
    string Name { get; }
    IReadOnlyList<string> RequiredHeaders { get; }
    bool IsCanonical { get; }
    bool Matches(IReadOnlyList<string> headers);
    Dictionary<string, string> Map(Dictionary<string, string> rawRow);
}
