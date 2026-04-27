using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.ScanSessions;

public class ScanSessionServiceTests
{
    private static AppDbContext CreateDb(string? name = null) => MockDbContextFactory.Create(name);

    private static IConfiguration BuildConfig(int expiryMinutes = 240, bool expandEnabled = false)
    {
        var dict = new Dictionary<string, string?>
        {
            ["ScanSessions:DefaultExpiryMinutes"] = expiryMinutes.ToString(),
            ["scanSessionAdHocExpandEnabled"] = expandEnabled ? "true" : "false"
        };
        return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
    }

    private static (ScanSessionService Service, Mock<IAdminService> AdminMock) CreateService(
        AppDbContext db,
        bool saleClosed = false,
        int expiryMinutes = 240)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(saleClosed);
        var service = new ScanSessionService(db, adminMock.Object, BuildConfig(expiryMinutes));
        return (service, adminMock);
    }

    private static Customer SeedCustomer(AppDbContext db, string picklistBarcode)
    {
        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            DisplayName = "Acme Buyer",
            PickupCode = "PU-123",
            PicklistBarcode = picklistBarcode,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Customers.Add(customer);
        return customer;
    }

    private static Seller SeedSeller(AppDbContext db, string picklistBarcode)
    {
        var seller = new Seller
        {
            Id = Guid.NewGuid(),
            DisplayName = "Student Sam",
            PicklistBarcode = picklistBarcode,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Sellers.Add(seller);
        return seller;
    }

    [Fact]
    public async Task CreateFromPicklist_AggregatesAllOpenOrders()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-AAAAAAAA");

        // 5 plants total across 2 orders
        var plants = Enumerable.Range(0, 5).Select(i => TestDataBuilder.CreatePlant(
            name: $"Plant {i}", barcode: $"BC-{i:000}", sku: $"SKU-{i:000}")).ToList();

        var order1 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var order2 = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.InProgress);

        var lines = new List<OrderLine>
        {
            TestDataBuilder.CreateOrderLine(order1.Id, plants[0].Id, qtyOrdered: 2),
            TestDataBuilder.CreateOrderLine(order1.Id, plants[1].Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(order1.Id, plants[2].Id, qtyOrdered: 3),
            TestDataBuilder.CreateOrderLine(order2.Id, plants[3].Id, qtyOrdered: 1),
            TestDataBuilder.CreateOrderLine(order2.Id, plants[4].Id, qtyOrdered: 2)
        };

        db.PlantCatalogs.AddRange(plants);
        db.Orders.AddRange(order1, order2);
        db.OrderLines.AddRange(lines);
        foreach (var p in plants)
            db.Inventories.Add(TestDataBuilder.CreateInventory(p.Id, 50));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var session = await service.CreateFromPicklistAsync("PLB-AAAAAAAA", "Pickup-1");

        session.Id.Should().NotBeEmpty();
        session.IncludedOrderIds.Should().HaveCount(2);
        session.IncludedOrderIds.Should().Contain(new[] { order1.Id, order2.Id });
        session.AggregatedLines.Should().HaveCount(5);
        session.RemainingTotal.Should().Be(2 + 1 + 3 + 1 + 2);
        session.EntityKind.Should().Be(ScanSessionEntityKind.Customer);
        session.EntityName.Should().Be("Acme Buyer");
    }

    [Fact]
    public async Task CreateFromPicklist_ExcludesDraftOrdersFromAggregation()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-BBBBBBBB");

        var plant1 = TestDataBuilder.CreatePlant(name: "P1", barcode: "BC-100", sku: "SKU-100");
        var plant2 = TestDataBuilder.CreatePlant(name: "P2", barcode: "BC-101", sku: "SKU-101");
        var openOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var draftOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft);
        var line1 = TestDataBuilder.CreateOrderLine(openOrder.Id, plant1.Id, qtyOrdered: 2);
        var line2 = TestDataBuilder.CreateOrderLine(draftOrder.Id, plant2.Id, qtyOrdered: 4);

        db.PlantCatalogs.AddRange(plant1, plant2);
        db.Orders.AddRange(openOrder, draftOrder);
        db.OrderLines.AddRange(line1, line2);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var session = await service.CreateFromPicklistAsync("PLB-BBBBBBBB", "Pickup-1");

        session.IncludedOrderIds.Should().ContainSingle().Which.Should().Be(openOrder.Id);
        session.AggregatedLines.Should().ContainSingle();
        session.AggregatedLines[0].PlantCatalogId.Should().Be(plant1.Id);
    }

    [Fact]
    public async Task CreateFromPicklist_UnknownBarcode_Throws()
    {
        using var db = CreateDb();
        var (service, _) = CreateService(db);

        var act = async () => await service.CreateFromPicklistAsync("PLB-ZZZZZZZZ", "Pickup-1");

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task CreateFromPicklist_UnknownPrefix_ThrowsValidation()
    {
        using var db = CreateDb();
        var (service, _) = CreateService(db);

        var act = async () => await service.CreateFromPicklistAsync("XYZ-12345678", "Pickup-1");

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task CreateFromPicklist_NoOpenOrders_ThrowsValidation()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-CCCCCCCC");
        // Only completed and draft orders -- not eligible.
        db.Orders.Add(TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Complete));
        db.Orders.Add(TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Draft));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var act = async () => await service.CreateFromPicklistAsync("PLB-CCCCCCCC", "Pickup-1");

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task CreateFromPicklist_ForSeller_AggregatesOpenOrders()
    {
        using var db = CreateDb();
        var seller = SeedSeller(db, "PLS-DDDDDDDD");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-S1", sku: "SKU-S1");
        var order = new Order
        {
            Id = Guid.NewGuid(),
            SellerId = seller.Id,
            OrderNumber = "ORD-S1",
            Status = OrderStatus.Open,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3);

        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var session = await service.CreateFromPicklistAsync("PLS-DDDDDDDD", "Pickup-1");

        session.EntityKind.Should().Be(ScanSessionEntityKind.Seller);
        session.IncludedOrderIds.Should().ContainSingle().Which.Should().Be(order.Id);
        session.RemainingTotal.Should().Be(3);
    }

    [Fact]
    public async Task ScanInSession_AcceptsAndDecrementsLine()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-EEEEEEEE");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-E1", sku: "SKU-E1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2);
        var inventory = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);

        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(inventory);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);

        var session = await service.CreateFromPicklistAsync("PLB-EEEEEEEE", "Pickup-1");

        var result = await service.ScanInSessionAsync(session.Id, "BC-E1");

        result.Result.Should().Be(ScanSessionResult.Accepted);
        result.Session.RemainingTotal.Should().Be(1);

        var updatedLine = await db.OrderLines.FindAsync(line.Id);
        updatedLine!.QtyFulfilled.Should().Be(1);

        var evt = await db.FulfillmentEvents.OrderByDescending(e => e.CreatedAt).FirstOrDefaultAsync();
        evt.Should().NotBeNull();
        evt!.Result.Should().Be(FulfillmentResult.Accepted);
    }

    [Fact]
    public async Task ScanInSession_PlantNotInCatalog_ReturnsNotFound()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-FFFFFFFF");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-F1", sku: "SKU-F1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);

        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-FFFFFFFF", "Pickup-1");

        var result = await service.ScanInSessionAsync(session.Id, "DOES-NOT-EXIST");

        result.Result.Should().Be(ScanSessionResult.NotFound);
    }

    [Fact]
    public async Task ScanInSession_AlreadyFulfilled_ReturnsAlreadyFulfilled()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-GGGGGGGG");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-G1", sku: "SKU-G1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        // Line is already fully fulfilled.
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1, qtyFulfilled: 1);

        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-GGGGGGGG", "Pickup-1");

        var result = await service.ScanInSessionAsync(session.Id, "BC-G1");

        result.Result.Should().Be(ScanSessionResult.AlreadyFulfilled);
    }

    [Fact]
    public async Task ScanInSession_PlantNotInAnyOrder_ReturnsNotInSession()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-HHHHHHHH");
        var orderedPlant = TestDataBuilder.CreatePlant(barcode: "BC-H1", sku: "SKU-H1");
        var foreignPlant = TestDataBuilder.CreatePlant(barcode: "BC-FOR", sku: "SKU-FOR");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, orderedPlant.Id, qtyOrdered: 1);

        db.PlantCatalogs.AddRange(orderedPlant, foreignPlant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(orderedPlant.Id, 5));
        db.Inventories.Add(TestDataBuilder.CreateInventory(foreignPlant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-HHHHHHHH", "Pickup-1");

        var result = await service.ScanInSessionAsync(session.Id, "BC-FOR");

        result.Result.Should().Be(ScanSessionResult.NotInSession);
    }

    [Fact]
    public async Task ScanInSession_SaleClosed_ReturnsSaleClosedBlocked()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-IIIIIIII");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-I1", sku: "SKU-I1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-IIIIIIII", "Pickup-1");

        var (closedService, _) = CreateService(db, saleClosed: true);

        var result = await closedService.ScanInSessionAsync(session.Id, "BC-I1");

        result.Result.Should().Be(ScanSessionResult.SaleClosedBlocked);
    }

    [Fact]
    public async Task Close_StampsClosedAt_AndSubsequentScansReturnExpired()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-JJJJJJJJ");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-J1", sku: "SKU-J1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-JJJJJJJJ", "Pickup-1");

        var closed = await service.CloseAsync(session.Id);
        closed.ClosedAt.Should().NotBeNull();

        var scan = await service.ScanInSessionAsync(session.Id, "BC-J1");
        scan.Result.Should().Be(ScanSessionResult.Expired);
    }

    [Fact]
    public async Task ExpireStaleAsync_ClosesSessionsPastExpiry()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-KKKKKKKK");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-K1", sku: "SKU-K1");
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-KKKKKKKK", "Pickup-1");

        // Force-expire by mutating the row directly.
        var entity = await db.ScanSessions.FindAsync(session.Id);
        entity!.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-10);
        await db.SaveChangesAsync();

        var closedCount = await service.ExpireStaleAsync();

        closedCount.Should().Be(1);
        var refreshed = await db.ScanSessions.FindAsync(session.Id);
        refreshed!.ClosedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ScanInSession_PastExpiresAt_ReturnsExpired()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-LLLLLLLL");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-L1", sku: "SKU-L1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-LLLLLLLL", "Pickup-1");

        var entity = await db.ScanSessions.FindAsync(session.Id);
        entity!.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        var result = await service.ScanInSessionAsync(session.Id, "BC-L1");

        result.Result.Should().Be(ScanSessionResult.Expired);
    }

    [Fact]
    public async Task ScanInSession_RoutesToOldestOrderFirst()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-MMMMMMMM");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-M1", sku: "SKU-M1");

        var olderOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        olderOrder.CreatedAt = DateTimeOffset.UtcNow.AddDays(-2);
        var newerOrder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        newerOrder.CreatedAt = DateTimeOffset.UtcNow.AddDays(-1);

        var olderLine = TestDataBuilder.CreateOrderLine(olderOrder.Id, plant.Id, qtyOrdered: 1);
        var newerLine = TestDataBuilder.CreateOrderLine(newerOrder.Id, plant.Id, qtyOrdered: 1);

        db.PlantCatalogs.Add(plant);
        db.Orders.AddRange(olderOrder, newerOrder);
        db.OrderLines.AddRange(olderLine, newerLine);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, 5));
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-MMMMMMMM", "Pickup-1");

        var first = await service.ScanInSessionAsync(session.Id, "BC-M1");
        first.Result.Should().Be(ScanSessionResult.Accepted);

        var olderRefreshed = await db.OrderLines.FindAsync(olderLine.Id);
        var newerRefreshed = await db.OrderLines.FindAsync(newerLine.Id);
        olderRefreshed!.QtyFulfilled.Should().Be(1);
        newerRefreshed!.QtyFulfilled.Should().Be(0);

        var second = await service.ScanInSessionAsync(session.Id, "BC-M1");
        second.Result.Should().Be(ScanSessionResult.Accepted);

        olderRefreshed = await db.OrderLines.FindAsync(olderLine.Id);
        newerRefreshed = await db.OrderLines.FindAsync(newerLine.Id);
        olderRefreshed!.QtyFulfilled.Should().Be(1);
        newerRefreshed!.QtyFulfilled.Should().Be(1);

        var third = await service.ScanInSessionAsync(session.Id, "BC-M1");
        third.Result.Should().Be(ScanSessionResult.AlreadyFulfilled);
    }

    [Fact]
    public async Task Expand_GatedOff_ThrowsInvalidOperation()
    {
        using var db = CreateDb();
        var customer = SeedCustomer(db, "PLB-NNNNNNNN");
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-N1", sku: "SKU-N1");
        var order = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 1);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var (service, _) = CreateService(db);
        var session = await service.CreateFromPicklistAsync("PLB-NNNNNNNN", "Pickup-1");

        var act = async () => await service.ExpandAsync(session.Id, new[] { Guid.NewGuid() });

        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
