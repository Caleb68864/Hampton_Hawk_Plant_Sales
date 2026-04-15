using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;

public class FormatAdapterRegistry
{
    private readonly IReadOnlyList<IImportFormatAdapter> _adapters;
    private readonly ILogger<FormatAdapterRegistry> _logger;

    public FormatAdapterRegistry(IEnumerable<IImportFormatAdapter> adapters, ILogger<FormatAdapterRegistry>? logger = null)
    {
        _adapters = adapters?.ToList() ?? new List<IImportFormatAdapter>();
        _logger = logger ?? NullLogger<FormatAdapterRegistry>.Instance;
    }

    /// <summary>
    /// Creates a registry wired with the built-in adapter set. Convenience for tests / non-DI contexts.
    /// </summary>
    public static FormatAdapterRegistry CreateDefault(ILogger<FormatAdapterRegistry>? logger = null)
    {
        var adapters = new IImportFormatAdapter[]
        {
            new HamptonHawks2026OrdersAdapter(),
            new HamptonHawksR1PlantsAdapter(),
            new HamptonHawksSbpInventoryAdapter(),
            new CanonicalOrdersAdapter(),
            new CanonicalPlantsAdapter(),
            new CanonicalInventoryAdapter()
        };
        return new FormatAdapterRegistry(adapters, logger);
    }

    public IImportFormatAdapter? Resolve(ImportType type, IReadOnlyList<string> headers)
    {
        var scoped = _adapters.Where(a => a.Type == type).ToList();

        var fileSpecificMatches = scoped
            .Where(a => !a.IsCanonical && a.Matches(headers))
            .ToList();

        if (fileSpecificMatches.Count > 1)
        {
            _logger.LogWarning(
                "Multiple file-specific adapters matched for import type {ImportType}: {Adapters}. Using first registered ({Chosen}).",
                type,
                string.Join(", ", fileSpecificMatches.Select(a => a.Name)),
                fileSpecificMatches[0].Name);
        }

        if (fileSpecificMatches.Count > 0)
        {
            return fileSpecificMatches[0];
        }

        var canonicalMatch = scoped.FirstOrDefault(a => a.IsCanonical && a.Matches(headers));
        return canonicalMatch;
    }
}
