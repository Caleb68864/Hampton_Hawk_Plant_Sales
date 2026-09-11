using System.Text.RegularExpressions;
using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.ScanSessions;

/// <summary>
/// Pick-list barcodes are written in one case and scanned in another.
///
/// Writers: <see cref="AppDbContext.NewPicklistBarcode"/> emits
/// <c>prefix + lowercase hex</c>, and the AddPicklistBarcodes migration
/// backfills with Postgres <c>md5()</c>, which is also lowercase. So every
/// stored value looks like <c>PLB-3f9a2c1d</c>.
///
/// Reader: the pickup station posts what <c>normalizeOrderLookupValue</c> in
/// <c>web/src/utils/orderLookup.ts</c> returns, and that function ends in
/// <c>.toUpperCase()</c> -- so the wire value is <c>PLB-3F9A2C1D</c>.
/// <c>web/src/utils/orderLookup.test.ts</c> pins that uppercasing from the
/// other side.
///
/// Every other test in this directory seeds a barcode like "PLB-AAAAAAAA",
/// which no writer in this codebase can produce and which is unchanged by
/// uppercasing. That is why 525 tests could not see this. These tests seed the
/// shape the application actually writes and submit what the browser actually
/// sends.
/// </summary>
public class PicklistBarcodeCaseTests
{
    /// <summary>Format both writers produce: uppercase prefix, lowercase hex body.</summary>
    private const string BuyerBarcodePattern = "^PLB-[0-9a-f]{8}$";
    private const string StudentBarcodePattern = "^PLS-[0-9a-f]{8}$";

    // Fixed rather than generated: a random 8-hex body is all digits about 2.3%
    // of the time, and these tests would then be vacuous instead of failing.
    // BarcodeFixtures_MatchWhatTheWritersProduce ties these back to the writer.
    private const string StoredBuyerBarcode = "PLB-3f9a2c1d";
    private const string StoredStudentBarcode = "PLS-7b1e4d0a";

    private static IConfiguration BuildConfig() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ScanSessions:DefaultExpiryMinutes"] = "240"
            })
            .Build();

    private static ScanSessionService CreateService(AppDbContext db)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        return new ScanSessionService(db, adminMock.Object, BuildConfig());
    }

    /// <summary>
    /// The transformation <c>web/src/utils/orderLookup.ts</c> applies before
    /// posting <c>scannedBarcode</c>: strip control characters and whitespace,
    /// then uppercase.
    /// </summary>
    private static string AsThePickupStationSendsIt(string scanned) =>
        scanned.Trim().ToUpperInvariant();

    private static Customer SeedCustomerWithOpenOrder(AppDbContext db, string barcode)
    {
        var customer = TestDataBuilder.CreateCustomer("Acme Buyer");
        customer.PicklistBarcode = barcode;
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-CASE-1", sku: "SKU-CASE-1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        return customer;
    }

    private static Seller SeedSellerWithOpenOrder(AppDbContext db, string barcode)
    {
        var seller = new Seller
        {
            Id = Guid.NewGuid(),
            DisplayName = "Student Sam",
            PicklistBarcode = barcode,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-CASE-2", sku: "SKU-CASE-2");
        var order = new Order
        {
            Id = Guid.NewGuid(),
            SellerId = seller.Id,
            OrderNumber = "ORD-CASE-2",
            Status = OrderStatus.Open,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2);

        db.Sellers.Add(seller);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        return seller;
    }

    [Fact]
    public void BarcodeFixtures_MatchWhatTheWritersProduce()
    {
        // The premise of every test below. If the generator stopped emitting
        // lowercase, the fixtures would no longer represent stored data and the
        // case tests would pass while proving nothing -- so fail here instead.
        foreach (var _ in Enumerable.Range(0, 32))
        {
            AppDbContext.NewPicklistBarcode("PLB-").Should().MatchRegex(BuyerBarcodePattern);
            AppDbContext.NewPicklistBarcode("PLS-").Should().MatchRegex(StudentBarcodePattern);
        }

        StoredBuyerBarcode.Should().MatchRegex(BuyerBarcodePattern);
        StoredStudentBarcode.Should().MatchRegex(StudentBarcodePattern);

        // And they must actually be case-sensitive, or "uppercased" is a no-op.
        StoredBuyerBarcode.Should().NotBe(StoredBuyerBarcode.ToUpperInvariant());
        StoredStudentBarcode.Should().NotBe(StoredStudentBarcode.ToUpperInvariant());
    }

    [Fact]
    public void MigrationBackfill_WritesTheSameLowercaseShape()
    {
        // The other writer: 20260426162224_AddPicklistBarcodes... backfills with
        // 'PLB-' || substr(md5(...), 1, 8). Postgres md5() is lowercase hex, so
        // rows predating the C# generator carry the same format. Read the
        // migration rather than restating its SQL here.
        var migration = File.ReadAllText(Path.Combine(
            RepoRoot(),
            "api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations",
            "20260426162224_AddPicklistBarcodesAndScanSessions.cs"));

        migration.Should().Contain("'PLB-' || substr(md5(");
        migration.Should().Contain("'PLS-' || substr(md5(");
        // No upper()/initcap() wrapping: the backfilled body stays lowercase.
        Regex.IsMatch(migration, @"upper\s*\(", RegexOptions.IgnoreCase).Should().BeFalse();
    }

    [Fact]
    public async Task CreateFromPicklist_FindsCustomer_WhenTheStationUppercasesTheScan()
    {
        using var db = MockDbContextFactory.Create();
        var customer = SeedCustomerWithOpenOrder(db, StoredBuyerBarcode);
        await db.SaveChangesAsync();

        var scanned = AsThePickupStationSendsIt(StoredBuyerBarcode);

        // Probe reached its subject: stored and scanned really do differ, so a
        // case-sensitive comparison cannot match them.
        scanned.Should().NotBe(StoredBuyerBarcode);

        var session = await CreateService(db).CreateFromPicklistAsync(scanned, "Pickup-1");

        session.EntityKind.Should().Be(ScanSessionEntityKind.Customer);
        session.EntityId.Should().Be(customer.Id);
        session.RemainingTotal.Should().Be(2);
    }

    [Fact]
    public async Task CreateFromPicklist_FindsSeller_WhenTheStationUppercasesTheScan()
    {
        using var db = MockDbContextFactory.Create();
        var seller = SeedSellerWithOpenOrder(db, StoredStudentBarcode);
        await db.SaveChangesAsync();

        var scanned = AsThePickupStationSendsIt(StoredStudentBarcode);
        scanned.Should().NotBe(StoredStudentBarcode);

        var session = await CreateService(db).CreateFromPicklistAsync(scanned, "Pickup-1");

        session.EntityKind.Should().Be(ScanSessionEntityKind.Seller);
        session.EntityId.Should().Be(seller.Id);
        session.RemainingTotal.Should().Be(2);
    }

    [Fact]
    public async Task CreateFromPicklist_FindsCustomer_WhenTheScanArrivesEntirelyLowercase()
    {
        // A wedge configured to lowercase, or a volunteer typing the code off a
        // printed sheet, produces "plb-3f9a2c1d" -- the prefix in the wrong case
        // as well as the body.
        using var db = MockDbContextFactory.Create();
        var customer = SeedCustomerWithOpenOrder(db, StoredBuyerBarcode);
        await db.SaveChangesAsync();

        var scanned = StoredBuyerBarcode.ToLowerInvariant();
        scanned.Should().NotBe(StoredBuyerBarcode);

        var session = await CreateService(db).CreateFromPicklistAsync(scanned, "Pickup-1");

        session.EntityId.Should().Be(customer.Id);
    }

    [Fact]
    public async Task CreateFromPicklist_FindsCustomer_WhenTheScanIsExactlyAsStored()
    {
        // The form the station would send if the web stopped uppercasing. It has
        // to keep working, so the fix cannot simply swap one case for another.
        using var db = MockDbContextFactory.Create();
        var customer = SeedCustomerWithOpenOrder(db, StoredBuyerBarcode);
        await db.SaveChangesAsync();

        var session = await CreateService(db)
            .CreateFromPicklistAsync(StoredBuyerBarcode, "Pickup-1");

        session.EntityId.Should().Be(customer.Id);
    }

    [Fact]
    public async Task CreateFromPicklist_StillRejectsAnUnknownBarcode()
    {
        // Control: normalising the scan must not turn a miss into a hit.
        using var db = MockDbContextFactory.Create();
        SeedCustomerWithOpenOrder(db, StoredBuyerBarcode);
        await db.SaveChangesAsync();

        var act = async () => await CreateService(db)
            .CreateFromPicklistAsync("PLB-deadbeef", "Pickup-1");

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "forge-project.json")))
            dir = dir.Parent;

        dir.Should().NotBeNull("the test must be able to locate the repository root");
        return dir!.FullName;
    }
}
