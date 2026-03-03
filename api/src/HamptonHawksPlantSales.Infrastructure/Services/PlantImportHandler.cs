using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class PlantImportHandler
{
    private readonly AppDbContext _db;

    public PlantImportHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(int imported, int skipped, List<ImportIssue> issues)> HandleAsync(
        Guid batchId, List<Dictionary<string, string>> rows)
    {
        int imported = 0;
        int skipped = 0;
        var issues = new List<ImportIssue>();

        var existingSkus = await _db.PlantCatalogs
            .Where(p => p.DeletedAt == null)
            .Select(p => p.Sku)
            .ToListAsync();
        var skuSet = new HashSet<string>(existingSkus, StringComparer.OrdinalIgnoreCase);

        var existingBarcodes = await _db.PlantCatalogs
            .Where(p => p.DeletedAt == null)
            .Select(p => p.Barcode)
            .ToListAsync();
        var barcodeSet = new HashSet<string>(existingBarcodes, StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            int rowNumber = i + 2; // 1-based, skip header
            var rawData = string.Join(",", row.Select(kv => $"{kv.Key}={kv.Value}"));

            var sku = row.GetValueOrDefault("Sku")?.Trim() ?? "";
            var name = row.GetValueOrDefault("Name")?.Trim() ?? "";
            var variant = row.GetValueOrDefault("Variant")?.Trim();
            var priceStr = row.GetValueOrDefault("Price")?.Trim() ?? "";
            var barcode = row.GetValueOrDefault("Barcode")?.Trim() ?? "";
            var isActiveStr = row.GetValueOrDefault("IsActive")?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(sku))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "MissingSku",
                    Sku = sku,
                    Barcode = barcode,
                    Message = "Sku is required.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (string.IsNullOrWhiteSpace(barcode))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "MissingBarcode",
                    Sku = sku,
                    Barcode = barcode,
                    Message = "Barcode is required.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (skuSet.Contains(sku))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "DuplicateSku",
                    Sku = sku,
                    Barcode = barcode,
                    Message = $"Sku '{sku}' already exists.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            if (barcodeSet.Contains(barcode))
            {
                issues.Add(new ImportIssue
                {
                    ImportBatchId = batchId,
                    RowNumber = rowNumber,
                    IssueType = "DuplicateBarcode",
                    Sku = sku,
                    Barcode = barcode,
                    Message = $"Barcode '{barcode}' already exists.",
                    RawData = rawData
                });
                skipped++;
                continue;
            }

            decimal? price = null;
            if (!string.IsNullOrWhiteSpace(priceStr) && decimal.TryParse(priceStr, out var parsedPrice))
                price = parsedPrice;

            bool isActive = true;
            if (!string.IsNullOrWhiteSpace(isActiveStr))
            {
                if (bool.TryParse(isActiveStr, out var parsedActive))
                    isActive = parsedActive;
            }

            var plant = new PlantCatalog
            {
                Sku = sku,
                Name = string.IsNullOrWhiteSpace(name) ? sku : name,
                Variant = string.IsNullOrWhiteSpace(variant) ? null : variant,
                Price = price,
                Barcode = barcode,
                IsActive = isActive
            };

            _db.PlantCatalogs.Add(plant);

            // Also create Inventory row with OnHandQty=0
            _db.Inventories.Add(new Inventory
            {
                PlantCatalogId = plant.Id,
                OnHandQty = 0
            });

            skuSet.Add(sku);
            barcodeSet.Add(barcode);
            imported++;
        }

        return (imported, skipped, issues);
    }
}
