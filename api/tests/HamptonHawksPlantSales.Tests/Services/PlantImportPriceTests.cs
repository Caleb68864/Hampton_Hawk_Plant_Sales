using System.Text;
using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class PlantImportPriceTests
{
    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));

    private static async Task<List<ImportIssue>> IssuesFor(ImportService service, Guid batchId)
    {
        var page = await service.GetBatchIssuesAsync(batchId, null, new PaginationParams { Page = 1, PageSize = 100 });
        return page.Items.Select(i => new ImportIssue { IssueType = i.IssueType, RowNumber = i.RowNumber }).ToList();
    }

    // ── I5: currency-formatted prices ──

    [Theory]
    [InlineData("$12.50", 12.50)]
    [InlineData("1,234.50", 1234.50)]
    [InlineData(" $ 7 ", 7)]
    public async Task PlantImport_ParsesCurrencyFormattedPrice(string raw, decimal expected)
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        var result = await service.ImportAsync(ImportType.Plants, "plants.csv",
            Csv($"Sku,Name,Variant,Price,Barcode\nSKU-P,Fern,V,\"{raw}\",BC-P\n"));

        result.ImportedCount.Should().Be(1);
        (await db.PlantCatalogs.SingleAsync(p => p.Sku == "SKU-P")).Price.Should().Be(expected);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("-5")]
    public async Task PlantImport_UnparsableOrNegativePrice_IsAnIssueAndKeepsExistingPrice(string raw)
    {
        using var db = MockDbContextFactory.Create();
        var seed = TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1", name: "Old");
        seed.Price = 9.99m;
        db.PlantCatalogs.Add(seed);
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var result = await service.ImportAsync(ImportType.Plants, "plants.csv",
            Csv($"Sku,Name,Variant,Price,Barcode\nSKU-1,New,V,{raw},BC-1\n"),
            new ImportOptions { UpsertPlantsBySku = true });

        result.ImportedCount.Should().Be(0);
        result.SkippedCount.Should().Be(1);
        (await IssuesFor(service, result.BatchId)).Should().ContainSingle(i => i.IssueType == "InvalidPrice");
        db.ChangeTracker.Clear();
        var saved = await db.PlantCatalogs.SingleAsync(p => p.Sku == "SKU-1");
        saved.Price.Should().Be(9.99m);
        saved.Name.Should().Be("Old", "the row was skipped, not partially applied");
    }

    [Fact]
    public async Task PlantImport_BlankPriceOnUpsert_KeepsExistingPrice()
    {
        using var db = MockDbContextFactory.Create();
        var seed = TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1");
        seed.Price = 4.25m;
        db.PlantCatalogs.Add(seed);
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        await service.ImportAsync(ImportType.Plants, "plants.csv",
            Csv("Sku,Name,Variant,Price,Barcode\nSKU-1,Renamed,V,,BC-1\n"),
            new ImportOptions { UpsertPlantsBySku = true });

        db.ChangeTracker.Clear();
        (await db.PlantCatalogs.SingleAsync(p => p.Sku == "SKU-1")).Price.Should().Be(4.25m);
    }
}
