using System.IO.Compression;
using ClosedXML.Excel;
using System.Text;
using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using FluentValidation;
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
    public async Task OrderImport_ThrowsHelpfulError_WhenImportedOrderNumberAlreadyExists()
    {
        using var db = MockDbContextFactory.Create();
        var customer = new Customer { DisplayName = "Existing Customer", PickupCode = "EXIST1" };
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1"));
        db.Orders.Add(new Order { Customer = customer, OrderNumber = "ORD-1" });
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nORD-1,Existing Customer,SKU-1,2\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.ImportAsync(ImportType.Orders, "orders.csv", stream));

        Assert.Contains("already exists", ex.Message);
    }

    [Fact]
    public async Task OrderImport_UsesUniqueOrderNumber_WhenConfirmedAndImportedOrderNumberAlreadyExists()
    {
        using var db = MockDbContextFactory.Create();
        var customer = new Customer { DisplayName = "Existing Customer", PickupCode = "EXIST1" };
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1"));
        db.Orders.Add(new Order { Customer = customer, OrderNumber = "ORD-1" });
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nORD-1,Existing Customer,SKU-1,2\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var result = await service.ImportAsync(
            ImportType.Orders,
            "orders.csv",
            stream,
            new ImportOptions { ResolveDuplicateOrderNumbers = true });

        Assert.Equal(1, result.ImportedCount);

        var orderNumbers = await db.Orders
            .OrderBy(o => o.OrderNumber)
            .Select(o => o.OrderNumber)
            .ToListAsync();

        Assert.Contains("ORD-1", orderNumbers);
        Assert.Contains("ORD-1-2", orderNumbers);
    }


    [Fact]
    public async Task PlantImport_XlsxWithZeroWorksheets_ThrowsValidationError()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        using var stream = CreateEmptyXlsxStream();

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.ImportAsync(ImportType.Plants, "plants.xlsx", stream));

        Assert.Contains("does not contain any worksheets", ex.Message);
    }

    [Fact]
    public async Task PlantImport_XlsxWithBlankHeaderRow_ThrowsValidationError()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        using var stream = CreateWorkbookStream(ws =>
        {
            ws.Cell(2, 1).Value = "SKU-1";
            ws.Cell(2, 2).Value = "Fern";
        });

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.ImportAsync(ImportType.Plants, "plants.xlsx", stream));

        Assert.Contains("blank column name", ex.Message);
    }

    [Fact]
    public async Task PlantImport_XlsxWithDuplicateHeaders_ThrowsValidationError()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);
        using var stream = CreateWorkbookStream(ws =>
        {
            ws.Cell(1, 1).Value = "Sku";
            ws.Cell(1, 2).Value = "Sku";
            ws.Cell(2, 1).Value = "SKU-1";
            ws.Cell(2, 2).Value = "SKU-1";
        });

        var ex = await Assert.ThrowsAsync<ValidationException>(() => service.ImportAsync(ImportType.Plants, "plants.xlsx", stream));

        Assert.Contains("duplicate column name", ex.Message);
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


    // ── EP-45: Get Import Batches with Pagination ──

    [Fact]
    public async Task GetBatchesAsync_ReturnsPaginatedBatches()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var batch1 = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "plants-2026.csv",
            TotalRows = 50,
            ImportedCount = 48,
            SkippedCount = 2
        };
        var batch2 = new ImportBatch
        {
            Type = ImportType.Inventory,
            Filename = "inventory-2026.csv",
            TotalRows = 30,
            ImportedCount = 30,
            SkippedCount = 0
        };
        var batch3 = new ImportBatch
        {
            Type = ImportType.Orders,
            Filename = "orders-2026.csv",
            TotalRows = 100,
            ImportedCount = 95,
            SkippedCount = 5
        };

        db.ImportBatches.AddRange(batch1, batch2, batch3);
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act: first page
        var page1 = await service.GetBatchesAsync(new PaginationParams { Page = 1, PageSize = 2 });

        // Assert page 1
        page1.Items.Should().HaveCount(2);
        page1.TotalCount.Should().Be(3);
        page1.Page.Should().Be(1);
        page1.PageSize.Should().Be(2);
        page1.TotalPages.Should().Be(2);

        // Each item should have valid fields
        foreach (var item in page1.Items)
        {
            item.Id.Should().NotBeEmpty();
            item.Type.Should().NotBeNullOrEmpty();
            item.Filename.Should().NotBeNullOrEmpty();
            item.TotalRows.Should().BeGreaterOrEqualTo(0);
            item.ImportedCount.Should().BeGreaterOrEqualTo(0);
            item.SkippedCount.Should().BeGreaterOrEqualTo(0);
            item.CreatedAt.Should().NotBe(default);
        }

        // Act: second page
        var page2 = await service.GetBatchesAsync(new PaginationParams { Page = 2, PageSize = 2 });

        // Assert page 2
        page2.Items.Should().HaveCount(1);
        page2.Page.Should().Be(2);
        page2.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task GetBatchesAsync_BatchFieldsMatchSeededData()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var batch = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "plants-2026.csv",
            TotalRows = 50,
            ImportedCount = 48,
            SkippedCount = 2
        };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act
        var result = await service.GetBatchesAsync(new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        var item = result.Items.Should().ContainSingle().Subject;
        item.Id.Should().Be(batch.Id);
        item.Type.Should().Be("Plants");
        item.Filename.Should().Be("plants-2026.csv");
        item.TotalRows.Should().Be(50);
        item.ImportedCount.Should().Be(48);
        item.SkippedCount.Should().Be(2);
    }

    [Fact]
    public async Task GetBatchesAsync_ExcludesSoftDeletedBatches()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var activeBatch = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "active.csv",
            TotalRows = 10,
            ImportedCount = 10,
            SkippedCount = 0
        };
        var deletedBatch = new ImportBatch
        {
            Type = ImportType.Orders,
            Filename = "deleted.csv",
            TotalRows = 5,
            ImportedCount = 5,
            SkippedCount = 0,
            DeletedAt = DateTimeOffset.UtcNow
        };

        db.ImportBatches.AddRange(activeBatch, deletedBatch);
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act
        var result = await service.GetBatchesAsync(new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Filename.Should().Be("active.csv");
    }

    // ── EP-46: Get Batch Issues ──

    [Fact]
    public async Task GetBatchIssuesAsync_ReturnsIssuesForBatch()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var batch = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "plants-with-errors.csv",
            TotalRows = 10,
            ImportedCount = 7,
            SkippedCount = 3
        };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        db.ImportIssues.AddRange(
            new ImportIssue
            {
                ImportBatchId = batch.Id,
                RowNumber = 2,
                IssueType = "DuplicateSku",
                Sku = "PLT-DUP",
                Message = "Duplicate SKU found"
            },
            new ImportIssue
            {
                ImportBatchId = batch.Id,
                RowNumber = 5,
                IssueType = "InvalidData",
                Sku = "PLT-BAD",
                Message = "Price must be greater than zero"
            },
            new ImportIssue
            {
                ImportBatchId = batch.Id,
                RowNumber = 8,
                IssueType = "MissingField",
                Sku = null,
                Message = "Name is required"
            });
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act
        var result = await service.GetBatchIssuesAsync(batch.Id, null, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.Items.Should().HaveCount(3);
        result.TotalCount.Should().Be(3);

        // Verify each item has required fields
        foreach (var issue in result.Items)
        {
            issue.Id.Should().NotBeEmpty();
            issue.RowNumber.Should().BeGreaterThan(0);
            issue.IssueType.Should().NotBeNullOrEmpty();
            issue.Message.Should().NotBeNullOrEmpty();
        }

        // Verify specific issue data
        var issue2 = result.Items.Should().Contain(i => i.RowNumber == 2).Subject;
        issue2.IssueType.Should().Be("DuplicateSku");
        issue2.Sku.Should().Be("PLT-DUP");

        var issue5 = result.Items.Should().Contain(i => i.RowNumber == 5).Subject;
        issue5.IssueType.Should().Be("InvalidData");

        var issue8 = result.Items.Should().Contain(i => i.RowNumber == 8).Subject;
        issue8.Message.Should().Contain("required");
    }

    [Fact]
    public async Task GetBatchIssuesAsync_SearchFiltersBySkuAndMessage()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var batch = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "plants-with-errors.csv",
            TotalRows = 10,
            ImportedCount = 7,
            SkippedCount = 3
        };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        db.ImportIssues.AddRange(
            new ImportIssue
            {
                ImportBatchId = batch.Id,
                RowNumber = 2,
                IssueType = "DuplicateSku",
                Sku = "PLT-DUP",
                Message = "Duplicate SKU found"
            },
            new ImportIssue
            {
                ImportBatchId = batch.Id,
                RowNumber = 5,
                IssueType = "MissingField",
                Sku = null,
                Message = "Name is required"
            });
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act: search by SKU
        var result = await service.GetBatchIssuesAsync(batch.Id, "PLT-DUP", new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].Sku.Should().Be("PLT-DUP");
    }

    [Fact]
    public async Task GetBatchIssuesAsync_PaginationWorks()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();

        var batch = new ImportBatch
        {
            Type = ImportType.Plants,
            Filename = "plants-with-errors.csv",
            TotalRows = 10,
            ImportedCount = 7,
            SkippedCount = 3
        };
        db.ImportBatches.Add(batch);
        await db.SaveChangesAsync();

        db.ImportIssues.AddRange(
            new ImportIssue { ImportBatchId = batch.Id, RowNumber = 2, IssueType = "A", Message = "Issue A" },
            new ImportIssue { ImportBatchId = batch.Id, RowNumber = 5, IssueType = "B", Message = "Issue B" },
            new ImportIssue { ImportBatchId = batch.Id, RowNumber = 8, IssueType = "C", Message = "Issue C" });
        await db.SaveChangesAsync();

        var service = new ImportService(db);

        // Act
        var result = await service.GetBatchIssuesAsync(batch.Id, null, new PaginationParams { Page = 1, PageSize = 2 });

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(3);
    }

    // ── DB-08: Import Batch Atomic Save ──

    [Fact]
    public async Task ImportPlants_MixedValidAndInvalid_PersistsValidAndTracksIssues()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        // CSV with 2 valid rows and 2 invalid rows:
        //   Row 2 (PLT-OK1): valid
        //   Row 3: missing SKU
        //   Row 4 (PLT-OK2): valid
        //   Row 5 (PLT-BAD): missing barcode
        var csv = "Sku,Name,Variant,Price,Barcode\nPLT-OK1,Valid Rose,Red,10.00,2000000001\n,Missing SKU,Blue,5.00,2000000002\nPLT-OK2,Valid Tulip,Yellow,8.00,2000000003\nPLT-BAD,,Pink,5.00,\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        // Act
        var result = await service.ImportAsync(ImportType.Plants, "mixed.csv", stream);

        // Assert: result counts
        result.TotalRows.Should().Be(4);
        result.ImportedCount.Should().Be(2);
        result.SkippedCount.Should().Be(2);
        result.IssueCount.Should().Be(2);

        // Assert: valid plants persisted
        var plants = await db.PlantCatalogs.ToListAsync();
        plants.Should().Contain(p => p.Sku == "PLT-OK1");
        plants.Should().Contain(p => p.Sku == "PLT-OK2");

        // Assert: issues tracked
        var issues = await db.ImportIssues.Where(i => i.ImportBatchId == result.BatchId).ToListAsync();
        issues.Should().HaveCount(2);

        // Assert: batch totals
        var batch = await db.ImportBatches.FirstAsync(b => b.Id == result.BatchId);
        batch.TotalRows.Should().Be(4);
        batch.ImportedCount.Should().Be(2);
        batch.SkippedCount.Should().Be(2);
    }

    [Fact]
    public async Task ImportPlants_AllRowsInvalid_NoPartialDataPersisted()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        // Seed one existing plant so we can verify count doesn't change
        var existingPlant = TestDataBuilder.CreatePlant(sku: "EXISTING", barcode: "BC-EXIST");
        db.PlantCatalogs.Add(existingPlant);
        await db.SaveChangesAsync();
        var plantCountBefore = await db.PlantCatalogs.CountAsync();

        // CSV where all rows are invalid (missing SKUs)
        var csv = "Sku,Name,Variant,Price,Barcode\n,Missing SKU 1,Blue,5.00,3000000001\n,Missing SKU 2,Green,1.00,3000000002\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        // Act
        var result = await service.ImportAsync(ImportType.Plants, "all-invalid.csv", stream);

        // Assert: result counts
        result.ImportedCount.Should().Be(0);
        result.SkippedCount.Should().Be(2);
        result.IssueCount.Should().Be(2);

        // Assert: no new plants created
        var plantCountAfter = await db.PlantCatalogs.CountAsync();
        plantCountAfter.Should().Be(plantCountBefore);

        // Assert: batch still created to document the failed import
        var batch = await db.ImportBatches.FirstAsync(b => b.Id == result.BatchId);
        batch.ImportedCount.Should().Be(0);

        // Assert: issues tracked
        var issues = await db.ImportIssues.Where(i => i.ImportBatchId == result.BatchId).ToListAsync();
        issues.Should().HaveCount(2);
    }

    /// <summary>
    /// Creates a minimal .xlsx (ZIP) with valid structure but zero worksheets.
    /// ClosedXML prevents saving an empty workbook, so we build the ZIP manually.
    /// </summary>
    private static MemoryStream CreateEmptyXlsxStream()
    {
        var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteEntry(archive, "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>""");

            WriteEntry(archive, "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");

            WriteEntry(archive, "xl/workbook.xml",
                """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets/></workbook>""");

            WriteEntry(archive, "xl/_rels/workbook.xml.rels",
                """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>""");
        }
        stream.Position = 0;
        return stream;

        static void WriteEntry(ZipArchive archive, string path, string content)
        {
            var entry = archive.CreateEntry(path);
            using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
            writer.Write(content);
        }
    }

    private static MemoryStream CreateWorkbookStream(Action<IXLWorksheet> configure)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("Sheet1");
        configure(worksheet);

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
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
