using System.Text;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class ImportServiceTests
{
    [Fact]
    public async Task PlantImport_UpsertsExistingSku_WhenEnabled()
    {
        using var db = MockDbContextFactory.Create();
        var seed = TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "OLD-BC", name: "Old Name");
        db.PlantCatalogs.Add(seed);
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "Sku,Name,Variant,Price,Barcode\nSKU-1,New Name,Large,12.34,NEW-BC\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(ImportType.Plants, "plants.csv", stream, new ImportOptions { UpsertPlantsBySku = true });

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(0, result.SkippedCount);
        Assert.False(result.DryRun);

        var saved = db.PlantCatalogs.Single(x => x.Sku == "SKU-1");
        Assert.Equal("New Name", saved.Name);
        Assert.Equal("NEW-BC", saved.Barcode);
        Assert.Equal(12.34m, saved.Price);
    }

    [Fact]
    public async Task PlantImport_DryRun_DoesNotPersistRowsOrBatch()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        var csv = "Sku,Name,Variant,Price,Barcode\nSKU-2,Fern,Var,3.50,BC-2\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(ImportType.Plants, "plants.csv", stream, new ImportOptions { DryRun = true });

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(Guid.Empty, result.BatchId);
        Assert.True(result.DryRun);
        Assert.Empty(db.PlantCatalogs);
        Assert.Empty(db.ImportBatches);
    }

    [Fact]
    public async Task PlantImport_DuplicateBarcode_CreatesIssueAndAccurateCounts()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        var csv = "Sku,Name,Variant,Price,Barcode\nSKU-A,Plant A,V,5.00,BC-1\nSKU-B,Plant B,V,6.00,BC-1\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(ImportType.Plants, "plants.csv", stream);

        Assert.Equal(2, result.TotalRows);
        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(1, result.SkippedCount);
        Assert.Equal(1, result.IssueCount);

        var issues = await service.GetBatchIssuesAsync(result.BatchId, null, new PaginationParams { Page = 1, PageSize = 10 });
        Assert.Single(issues.Items);
        Assert.Equal("DuplicateBarcode", issues.Items[0].IssueType);
    }

    [Fact]
    public async Task InventoryImport_UnknownSku_CreatesIssueAndContinues()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(sku: "KNOWN", barcode: "BC-KNOWN");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 1));
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "Sku,OnHandQty\nKNOWN,7\nMISSING,3\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(ImportType.Inventory, "inventory.csv", stream);

        Assert.Equal(1, result.ImportedCount);
        Assert.Equal(1, result.SkippedCount);

        var inv = await db.Inventories.SingleAsync(i => i.PlantCatalogId == plant.Id);
        Assert.Equal(7, inv.OnHandQty);

        var issues = await service.GetBatchIssuesAsync(result.BatchId, null, new PaginationParams { Page = 1, PageSize = 10 });
        Assert.Single(issues.Items);
        Assert.Equal("UnknownSku", issues.Items[0].IssueType);
    }

    [Fact]
    public async Task OrderImport_ParsesQtyOrdered_AndHandlesDuplicateCustomerNames()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1"));
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-2", barcode: "BC-2"));

        db.Customers.Add(new Customer { DisplayName = "Alex Smith", PickupCode = "A1" });
        db.Customers.Add(new Customer { DisplayName = "Alex Smith", PickupCode = "A2" });

        db.Sellers.Add(new Seller { DisplayName = "Seller Same" });
        db.Sellers.Add(new Seller { DisplayName = "Seller Same" });
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "OrderNumber,CustomerDisplayName,SellerDisplayName,Sku,QtyOrdered\nORD-1,Alex Smith,Seller Same,SKU-1,2\nORD-1,Alex Smith,Seller Same,SKU-2,3\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(ImportType.Orders, "orders.csv", stream);

        Assert.Equal(2, result.ImportedCount);
        Assert.Equal(0, result.SkippedCount);

        var order = await db.Orders.SingleAsync(o => o.OrderNumber == "ORD-1");
        var lines = await db.OrderLines.Where(l => l.OrderId == order.Id).OrderBy(l => l.QtyOrdered).ToListAsync();
        Assert.Equal(new[] { 2, 3 }, lines.Select(l => l.QtyOrdered).ToArray());
    }

    [Fact]
    public async Task OrderImport_Pdf_ExtractsCustomerAndLineItems()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "108", barcode: "BC-108"));
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "202", barcode: "BC-202"));
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var pdfPath = FindFromRepoRoot("rpcustorderspdf.pdf");
        using var stream = File.OpenRead(pdfPath);

        var result = await service.ImportAsync(ImportType.Orders, "orders.pdf", stream);

        Assert.True(result.ImportedCount >= 2);

        var customer = await db.Customers.SingleAsync(c => c.DisplayName == "Weedin, Lindsey");
        var order = await db.Orders.SingleAsync(o => o.CustomerId == customer.Id);
        var lines = await db.OrderLines.Where(l => l.OrderId == order.Id).ToListAsync();

        Assert.Contains(lines, l => db.PlantCatalogs.First(p => p.Id == l.PlantCatalogId).Sku == "108");
        Assert.Contains(lines, l => db.PlantCatalogs.First(p => p.Id == l.PlantCatalogId).Sku == "202");
    }

    [Fact]
    public async Task PlantImport_Pdf_ThrowsHelpfulMessage()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        var pdfPath = FindFromRepoRoot("rpcustorderspdf.pdf");
        using var stream = File.OpenRead(pdfPath);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ImportAsync(ImportType.Plants, "plants.pdf", stream));

        Assert.Contains("orders only", ex.Message);
    }

    private static string FindFromRepoRoot(string filename)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, filename);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            dir = dir.Parent;
        }

        throw new FileNotFoundException($"Could not locate {filename}");
    }
}
