using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;
using HamptonHawksPlantSales.Infrastructure.Services.ImportReading;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Import;

public class ImportFormatAdaptersTests
{
    // ── Reader unit tests ──

    [Fact]
    public void ExcelRowReader_WithBlankLeadingRow_ReadsHeadersFromFirstNonBlankRow()
    {
        var reader = new ExcelRowReader();
        using var stream = CreateWorkbookStream(ws =>
        {
            // Row 1 blank
            ws.Cell(2, 1).Value = "Order #";
            ws.Cell(2, 2).Value = "Name";
            ws.Cell(2, 3).Value = "Item #";
            ws.Cell(2, 4).Value = "Qnty";
            ws.Cell(3, 1).Value = "1";
            ws.Cell(3, 2).Value = "Jane Doe";
            ws.Cell(3, 3).Value = "101";
            ws.Cell(3, 4).Value = "2";
        });

        var (headers, rows) = reader.Read(stream);

        headers.Should().Equal("Order #", "Name", "Item #", "Qnty");
        rows.Should().HaveCount(1);
        rows[0]["Name"].Should().Be("Jane Doe");
    }

    [Fact]
    public void ExcelRowReader_WithBlankCellInsideHeaderRow_Throws()
    {
        var reader = new ExcelRowReader();
        using var stream = CreateWorkbookStream(ws =>
        {
            ws.Cell(1, 1).Value = "Sku";
            // 1,2 blank
            ws.Cell(1, 3).Value = "Barcode";
            ws.Cell(2, 1).Value = "SKU-1";
            ws.Cell(2, 3).Value = "BC-1";
        });

        var act = () => reader.Read(stream);
        act.Should().Throw<ValidationException>().WithMessage("*blank column name*");
    }

    // ── Registry unit tests ──

    [Fact]
    public void Registry_ResolvesCanonicalAdapter_ForCanonicalHeaders()
    {
        var registry = FormatAdapterRegistry.CreateDefault();
        var adapter = registry.Resolve(ImportType.Plants, new[] { "Sku", "Name", "Barcode" });
        adapter.Should().NotBeNull();
        adapter!.Name.Should().Be("CanonicalPlants");
    }

    [Fact]
    public void Registry_ResolvesFileSpecificAdapter_Over_Canonical()
    {
        var registry = FormatAdapterRegistry.CreateDefault();
        var adapter = registry.Resolve(ImportType.Plants, new[] { "Plant Name", "Item number", "Price" });
        adapter!.Name.Should().Be("HamptonHawksR1Plants");
    }

    [Fact]
    public void Registry_ReturnsNull_WhenNoAdapterMatches()
    {
        var registry = FormatAdapterRegistry.CreateDefault();
        var adapter = registry.Resolve(ImportType.Orders, new[] { "Foo", "Bar" });
        adapter.Should().BeNull();
    }

    // ── Adapter unit tests ──

    [Fact]
    public void Adapter_2026_MapsFullName()
    {
        var adapter = new HamptonHawks2026OrdersAdapter();
        var raw = new Dictionary<string, string>
        {
            ["Order #"] = "2",
            ["Name"] = "Pat Anderson",
            ["Phone"] = "402-631-9542",
            ["Email"] = "",
            ["Seller"] = "Lofton Ferguson",
            ["Item #"] = "112",
            ["Qnty"] = "4"
        };
        var mapped = adapter.Map(raw);

        mapped["OrderNumber"].Should().Be("2");
        mapped["CustomerFirstName"].Should().Be("Pat");
        mapped["CustomerLastName"].Should().Be("Anderson");
        mapped["CustomerDisplayName"].Should().Be("Pat Anderson");
        mapped["SellerFirstName"].Should().Be("Lofton");
        mapped["SellerLastName"].Should().Be("Ferguson");
        mapped["Sku"].Should().Be("112");
        mapped["QtyOrdered"].Should().Be("4");
        mapped["IsWalkUp"].Should().Be("false");
    }

    [Fact]
    public void Adapter_2026_MapsSingleTokenName()
    {
        var adapter = new HamptonHawks2026OrdersAdapter();
        var raw = new Dictionary<string, string>
        {
            ["Order #"] = "3",
            ["Name"] = "Cher",
            ["Item #"] = "1",
            ["Qnty"] = "1"
        };
        var mapped = adapter.Map(raw);
        mapped["CustomerFirstName"].Should().Be("Cher");
        mapped["CustomerLastName"].Should().Be(string.Empty);
        mapped["CustomerDisplayName"].Should().Be("Cher");
    }

    [Fact]
    public void Adapter_R1Plants_SynthesizesHHBarcode()
    {
        var adapter = new HamptonHawksR1PlantsAdapter();
        var raw = new Dictionary<string, string>
        {
            ["Plant Name"] = "Begonia (Assorted)",
            ["Item number"] = "101",
            ["Price"] = "3"
        };
        var mapped = adapter.Map(raw);
        mapped["Sku"].Should().Be("101");
        mapped["Name"].Should().Be("Begonia (Assorted)");
        mapped["Price"].Should().Be("3");
        mapped["Barcode"].Should().Be("HH000000000101");
        mapped["IsActive"].Should().Be("true");
    }

    [Fact]
    public void Adapter_2026_Matches_WhenItemHashHasTrailingSpace()
    {
        var adapter = new HamptonHawks2026OrdersAdapter();
        var headers = new[] { "Order #", "Name", "Phone", "Email", "Seller", "Item # ", "Qnty" };
        adapter.Matches(headers).Should().BeTrue();
    }

    [Fact]
    public void Adapter_CanonicalPlants_Matches_WithExtraHeaders()
    {
        var adapter = new CanonicalPlantsAdapter();
        var headers = new[] { "Sku", "Name", "Barcode", "Variant", "Price", "IsActive" };
        adapter.Matches(headers).Should().BeTrue();
    }

    // ── Integration tests against real fixtures ──

    [Fact]
    public async Task R1PlantsImport_Creates95PlantsWithHHBarcodes()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        await using var stream = OpenFixture("R1_Sales_Offerings.xlsx");
        var result = await service.ImportAsync(ImportType.Plants, "R1_Sales_Offerings.xlsx", stream);

        result.SourceFormat.Should().Be("HamptonHawksR1Plants");
        result.ImportedCount.Should().Be(95);
        result.IssueCount.Should().Be(0);

        var plants = await db.PlantCatalogs.ToListAsync();
        plants.Should().HaveCount(95);
        var barcodeRegex = new Regex(@"^HH\d{12}$");
        plants.Should().OnlyContain(p => barcodeRegex.IsMatch(p.Barcode) && p.IsActive);
    }

    [Fact]
    public async Task SalesByProductImport_IsIdempotentWithR1()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        await using (var stream1 = OpenFixture("R1_Sales_Offerings.xlsx"))
        {
            await service.ImportAsync(ImportType.Plants, "R1.xlsx", stream1,
                new ImportOptions { UpsertPlantsBySku = true });
        }

        var beforeCount = await db.PlantCatalogs.CountAsync();

        await using var stream2 = OpenFixture("Sales_by_Product_with_flat_totals.xlsx");
        var result = await service.ImportAsync(ImportType.Plants, "Sales_by_Product.xlsx", stream2,
            new ImportOptions { UpsertPlantsBySku = true });

        result.SourceFormat.Should().Be("HamptonHawksR1Plants");
        // The real SBP file contains 17 additional SKUs not in R1. The 95 overlapping
        // plants are upserted (not duplicated); the extras are newly added.
        var afterCount = await db.PlantCatalogs.CountAsync();
        afterCount.Should().Be(beforeCount + 17);
        result.IssueCount.Should().Be(0);
    }

    [Fact]
    public async Task Orders2026Import_GroupsRowsByOrderNumberWithZeroUnknownSku()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        // Import both plant files so every SKU referenced in the 2026 orders file
        // has a matching plant row (SBP contains 17 extra SKUs beyond R1).
        await using (var stream = OpenFixture("R1_Sales_Offerings.xlsx"))
        {
            await service.ImportAsync(ImportType.Plants, "R1.xlsx", stream,
                new ImportOptions { UpsertPlantsBySku = true });
        }
        await using (var stream = OpenFixture("Sales_by_Product_with_flat_totals.xlsx"))
        {
            await service.ImportAsync(ImportType.Plants, "SBP.xlsx", stream,
                new ImportOptions { UpsertPlantsBySku = true });
        }

        await using var orderStream = OpenFixture("2026_Orders_for_Importing.xlsx");
        var result = await service.ImportAsync(ImportType.Orders, "2026_Orders.xlsx", orderStream);

        result.SourceFormat.Should().Be("HamptonHawks2026Orders");

        var issues = await db.ImportIssues
            .Where(i => i.ImportBatchId == result.BatchId && i.IssueType == "UnknownSku")
            .CountAsync();
        issues.Should().Be(0);

        var orders = await db.Orders.ToListAsync();
        orders.Should().NotBeEmpty();
        orders.Should().OnlyContain(o => !o.IsWalkUp && o.Status == OrderStatus.Open);

        // Distinct Order # count from fixture should equal DB orders.
        // Re-read xlsx to count distinct order numbers.
        await using var countStream = OpenFixture("2026_Orders_for_Importing.xlsx");
        var reader = new ExcelRowReader();
        var (_, rows) = reader.Read(countStream);
        var distinctOrderNumbers = rows.Select(r => r.GetValueOrDefault("Order #")?.Trim() ?? "")
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();
        orders.Count.Should().Be(distinctOrderNumbers);
    }

    [Fact]
    public async Task CanonicalCsvOrders_StillImports()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "S-1", barcode: "BC-1"));
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var csv = "OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nORD-XYZ,Jane Smith,S-1,2\n";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));
        var result = await service.ImportAsync(ImportType.Orders, "orders.csv", stream);

        result.SourceFormat.Should().Be("CanonicalOrders");
        result.ImportedCount.Should().Be(1);
    }

    [Fact]
    public async Task CanonicalXlsxPlants_StillImports()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        using var stream = CreateWorkbookStream(ws =>
        {
            ws.Cell(1, 1).Value = "Sku";
            ws.Cell(1, 2).Value = "Name";
            ws.Cell(1, 3).Value = "Barcode";
            ws.Cell(1, 4).Value = "Variant";
            ws.Cell(1, 5).Value = "Price";
            ws.Cell(1, 6).Value = "IsActive";
            ws.Cell(2, 1).Value = "SKU-100";
            ws.Cell(2, 2).Value = "Fern";
            ws.Cell(2, 3).Value = "BC-100";
            ws.Cell(2, 4).Value = "Small";
            ws.Cell(2, 5).Value = "5.00";
            ws.Cell(2, 6).Value = "true";
        });

        var result = await service.ImportAsync(ImportType.Plants, "plants.xlsx", stream);
        result.SourceFormat.Should().Be("CanonicalPlants");
        result.ImportedCount.Should().Be(1);
    }

    [Fact]
    public async Task UnknownFormat_FailsWithUnknownFormatIssue()
    {
        using var db = MockDbContextFactory.Create();
        var service = new ImportService(db);

        using var stream = CreateWorkbookStream(ws =>
        {
            ws.Cell(1, 1).Value = "Alpha";
            ws.Cell(1, 2).Value = "Beta";
            ws.Cell(2, 1).Value = "a1";
            ws.Cell(2, 2).Value = "b1";
        });

        var result = await service.ImportAsync(ImportType.Plants, "bogus.xlsx", stream);
        result.SourceFormat.Should().BeNull();
        result.ImportedCount.Should().Be(0);
        result.IssueCount.Should().Be(1);

        var issue = await db.ImportIssues.SingleAsync(i => i.ImportBatchId == result.BatchId);
        issue.IssueType.Should().Be("UnknownFormat");
    }

    [Fact(Skip = "no PDF fixture snapshot available")]
    public void PdfOrderImport_RegressionUnchanged()
    {
        // No JSON baseline snapshot is committed under Fixtures/Import. The existing
        // OrderImport_Pdf_ExtractsCustomerAndLineItems test in Services/ImportServiceTests
        // covers PDF regression via an end-to-end assertion.
    }

    // ── Helpers ──

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

    private static FileStream OpenFixture(string filename)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "Fixtures", "Import", filename);
            if (File.Exists(candidate))
            {
                return File.OpenRead(candidate);
            }
            dir = dir.Parent;
        }
        throw new FileNotFoundException($"Could not locate fixture {filename}");
    }
}
