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

public class ImportCaseVariantSkuTests
{
    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));

    private static async Task<List<ImportIssue>> IssuesFor(ImportService service, Guid batchId)
    {
        var page = await service.GetBatchIssuesAsync(batchId, null, new PaginationParams { Page = 1, PageSize = 100 });
        return page.Items.Select(i => new ImportIssue { IssueType = i.IssueType, RowNumber = i.RowNumber }).ToList();
    }

    // ── I8: SKUs differing only by case must not crash the import ──

    [Fact]
    public async Task InventoryImport_WithCaseVariantSkus_DoesNotThrow()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "abc-1", barcode: "BC-A"));
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "ABC-1", barcode: "BC-B"));
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var act = () => service.ImportAsync(ImportType.Inventory, "inv.csv", Csv("Sku,OnHandQty\nabc-1,3\n"));

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task OrderImport_WithCaseVariantSkusAndPickupCodes_DoesNotThrow()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "abc-1", barcode: "BC-A"));
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "ABC-1", barcode: "BC-B"));
        db.Customers.Add(new Customer { DisplayName = "One", PickupCode = "code1" });
        db.Customers.Add(new Customer { DisplayName = "Two", PickupCode = "CODE1" });
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var act = () => service.ImportAsync(ImportType.Orders, "orders.csv",
            Csv("OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nO-1,Three,abc-1,1\n"));

        await act.Should().NotThrowAsync();
    }
}
