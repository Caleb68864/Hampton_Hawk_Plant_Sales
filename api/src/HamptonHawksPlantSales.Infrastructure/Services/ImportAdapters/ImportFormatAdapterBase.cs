using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public abstract class ImportFormatAdapterBase : IImportFormatAdapter
{
    public abstract ImportType Type { get; }
    public abstract string Name { get; }
    public abstract IReadOnlyList<string> RequiredHeaders { get; }
    public abstract bool IsCanonical { get; }

    public virtual bool Matches(IReadOnlyList<string> headers)
    {
        if (headers == null) return false;
        var normalized = new HashSet<string>(
            headers.Select(h => (h ?? string.Empty).Trim()),
            StringComparer.OrdinalIgnoreCase);
        return RequiredHeaders.All(required =>
            normalized.Contains((required ?? string.Empty).Trim()));
    }

    public abstract Dictionary<string, string> Map(Dictionary<string, string> rawRow);

    protected static string GetTrimmed(Dictionary<string, string> row, string key)
    {
        if (row == null) return string.Empty;
        // Try exact, then case-insensitive, then trimmed-case-insensitive match.
        if (row.TryGetValue(key, out var v)) return (v ?? string.Empty).Trim();
        foreach (var kv in row)
        {
            if (string.Equals(kv.Key?.Trim(), key.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return (kv.Value ?? string.Empty).Trim();
            }
        }
        return string.Empty;
    }
}
