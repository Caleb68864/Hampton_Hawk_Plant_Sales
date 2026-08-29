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

public class OrderImportQuantityTests
{
    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));

    private static async Task<List<ImportIssue>> IssuesFor(ImportService service, Guid batchId)
    {
        var page = await service.GetBatchIssuesAsync(batchId, null, new PaginationParams { Page = 1, PageSize = 100 });
        return page.Items.Select(i => new ImportIssue { IssueType = i.IssueType, RowNumber = i.RowNumber }).ToList();
    }

    // ── I9: bad quantities are issues, not silently 1 ──

    [Theory]
    [InlineData("0")]
    [InlineData("-2")]
    [InlineData("lots")]
    public async Task OrderImport_InvalidQuantity_IsReportedAndLineSkipped(string qty)
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1"));
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-2", barcode: "BC-2"));
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var result = await service.ImportAsync(ImportType.Orders, "orders.csv",
            Csv($"OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nO-1,Alex,SKU-1,{qty}\nO-1,Alex,SKU-2,2\n"));

        result.ImportedCount.Should().Be(1);
        result.SkippedCount.Should().Be(1);
        (await IssuesFor(service, result.BatchId)).Should().ContainSingle(i => i.IssueType == "InvalidQuantity" && i.RowNumber == 2);
        var lines = await db.OrderLines.ToListAsync();
        lines.Should().ContainSingle().Which.QtyOrdered.Should().Be(2);
    }
}
