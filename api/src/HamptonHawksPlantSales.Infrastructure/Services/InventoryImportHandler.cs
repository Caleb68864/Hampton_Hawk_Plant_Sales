using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class InventoryImportHandler
{
    private readonly AppDbContext _db;

    public InventoryImportHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(int imported, int skipped, List<ImportIssue> issues)> HandleAsync(
        Guid batchId, List<Dictionary<string, string>> rows)
    {
        int imported = 0;
        int skipped = 0;
        var issues = new List<ImportIssue>();

        var plants = await _db.PlantCatalogs
            .Where(p => p.DeletedAt == null)
            .ToDictionaryAsync(p => p.Sku, p => p.Id, StringComparer.OrdinalIgnoreCase);

        var inventories = await _db.Inventories
            .Where(inv => inv.DeletedAt == null)
            .ToDictionaryAsync(inv => inv.PlantCatalogId, inv => inv);

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            int rowNumber = i + 2;
            var rawData = string.Join(",", row.Select(kv => $"{kv.Key}={kv.Value}"));

            var sku = row.GetValueOrDefault("Sku")?.Trim() ?? "";
            var qtyStr = row.GetValueOrDefault("OnHandQty")?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(sku))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "MissingSku",
                    Sku = sku,
                    Message = "Sku is required.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (!plants.TryGetValue(sku, out var plantId))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "UnknownSku",
                    Sku = sku,
                    Message = $"No plant found with Sku '{sku}'.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (!int.TryParse(qtyStr, out var qty) || qty < 0)
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "InvalidQuantity",
                    Sku = sku,
                    Message = $"OnHandQty must be an integer >= 0, got '{qtyStr}'.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (inventories.TryGetValue(plantId, out var existing))
            {
                existing.OnHandQty = qty;
            }
            else
            {
                var inv = new Inventory
                {
                    PlantCatalogId = plantId,
                    OnHandQty = qty
                };
                _db.Inventories.Add(inv);
                inventories[plantId] = inv;
            }

            imported++;
        }

        return (imported, skipped, issues);
    }
}
