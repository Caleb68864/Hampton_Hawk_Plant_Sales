using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.WalkUp;

/// <summary>
/// The register decrements OnHandQty at scan time, so the availability check for
/// the *next* scan already sees the units this draft holds. Validating the line's
/// cumulative total against that reduced figure counts the draft's own units twice
/// and refuses to sell roughly half of every plant's stock. These tests run the
/// real <see cref="InventoryProtectionService"/> rather than a mock so the formula
/// and the register are exercised together.
/// </summary>
public class WalkUpRegisterAvailabilityTests
{
    private static WalkUpRegisterService CreateService(AppDbContext db)
    {
        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });
        return new WalkUpRegisterService(db, new InventoryProtectionService(db), adminMock.Object, TestConfig());
    }

    private static IConfiguration TestConfig() => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = "1234" })
        .Build();

    [Fact]
    public async Task Scan_CanSellEveryUnitOnHand_WhenNothingElseIsCommitted()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-ALL", sku: "ALL-1");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        for (var i = 1; i <= 10; i++)
        {
            await service.ScanIntoDraftAsync(draft.Id,
                new ScanIntoDraftRequest { PlantBarcode = "BC-ALL", ScanId = $"s{i}" });
        }

        var line = await db.OrderLines.SingleAsync(l => l.OrderId == draft.Id);
        line.QtyFulfilled.Should().Be(10);
        (await db.Inventories.SingleAsync(i => i.PlantCatalogId == plant.Id)).OnHandQty.Should().Be(0);

        var act = () => service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-ALL", ScanId = "s11" });
        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Scan_StillRespectsOtherOrdersCommitments()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-COMMIT", sku: "COMMIT-1");
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5));
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        db.OrderLines.Add(TestDataBuilder.CreateOrderLine(preorder.Id, plant.Id, qtyOrdered: 3, qtyFulfilled: 0));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-COMMIT", ScanId = "a" });
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-COMMIT", ScanId = "b" });

        var act = () => service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-COMMIT", ScanId = "c" });
        await act.Should().ThrowAsync<ValidationException>("only 2 of 5 units are free of preorder commitments");
    }

    [Fact]
    public async Task AdjustLine_CanIncreaseByRemainingOnHand_WithoutOverride()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-ADJUP", sku: "ADJUP-1");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 6));
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-ADJUP", ScanId = "s1" });
        var line = await db.OrderLines.SingleAsync(l => l.OrderId == draft.Id);

        // 1 on the line, 5 remaining on hand: raising to 6 uses exactly what is left.
        await service.AdjustLineAsync(draft.Id, line.Id, new AdjustLineRequest { PlantCatalogId = plant.Id, NewQty = 6 });

        (await db.OrderLines.FindAsync(line.Id))!.QtyFulfilled.Should().Be(6);
        (await db.Inventories.SingleAsync(i => i.PlantCatalogId == plant.Id)).OnHandQty.Should().Be(0);
    }
}
