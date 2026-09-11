using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.DependencyInjection;

namespace HamptonHawksPlantSales.Tests.ScanSessions;

/// <summary>
/// The pick-list scan, through the same front door the pickup station uses.
///
/// <see cref="PicklistBarcodeCaseTests"/> calls <c>ScanSessionService</c>
/// directly. This goes through the real <c>Program.cs</c> pipeline -- routing,
/// the <c>PickupCapable</c> policy, JSON model binding, the controller's
/// exception-to-status mapping -- with the body written out as the literal JSON
/// that <c>scanSessionsApi.create</c> in <c>web/src/api/scanSessions.ts</c>
/// posts from <c>PickupLookupPage.tsx</c>. A station scanning a printed sheet
/// sends exactly this, and before the fix it got a 404.
/// </summary>
public class PicklistScanEndpointTests
{
    // A stored value in the only shape either writer produces: uppercase prefix,
    // lowercase hex body. PicklistBarcodeCaseTests ties this to the writer.
    private const string StoredBarcode = "PLB-3f9a2c1d";

    // What normalizeOrderLookupValue (web/src/utils/orderLookup.ts) turns that
    // into before posting. Pinned from the web side by orderLookup.test.ts.
    private const string AsTheStationSendsIt = "PLB-3F9A2C1D";

    private static async Task<Guid> SeedCustomerWithOpenOrderAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var customer = TestDataBuilder.CreateCustomer("Acme Buyer");
        customer.PicklistBarcode = StoredBarcode;
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-EP-1", sku: "SKU-EP-1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        return customer.Id;
    }

    private static HttpContent StationBody(string scannedBarcode) =>
        new StringContent(
            $$"""{"scannedBarcode":"{{scannedBarcode}}","workstationName":"Pickup-1"}""",
            Encoding.UTF8,
            "application/json");

    [Fact]
    public async Task PostingTheBarcodeAsTheStationSendsIt_OpensASession()
    {
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");

        var customerId = await SeedCustomerWithOpenOrderAsync(factory.Services);

        // Probe reached its subject: the wire value really differs from the row.
        AsTheStationSendsIt.Should().NotBe(StoredBarcode);
        AsTheStationSendsIt.Should().Be(StoredBarcode.ToUpperInvariant());

        var response = await client.PostAsync("/api/scan-sessions", StationBody(AsTheStationSendsIt));

        var raw = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.OK, raw);

        // Read the wire JSON the way the web does. The API writes enums as
        // strings ("Customer"), which a default-options typed deserialise
        // cannot read -- asserting on the document keeps this about the contract.
        using var json = JsonDocument.Parse(raw);
        var root = json.RootElement;
        root.GetProperty("success").GetBoolean().Should().BeTrue();
        var data = root.GetProperty("data");
        data.GetProperty("entityKind").GetString().Should().Be(nameof(ScanSessionEntityKind.Customer));
        data.GetProperty("entityId").GetGuid().Should().Be(customerId);
        data.GetProperty("remainingTotal").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task PostingAnUnknownBarcode_Still404s()
    {
        // Control: the endpoint must still be able to say "no such sheet".
        await using var factory = new TestApiFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");

        await SeedCustomerWithOpenOrderAsync(factory.Services);

        var response = await client.PostAsync("/api/scan-sessions", StationBody("PLB-DEADBEEF"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
