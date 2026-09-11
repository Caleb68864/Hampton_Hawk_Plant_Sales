using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// Inventory adjustments must never leave OnHandQty below zero: a -50 on 10 on
/// hand produced -40 and every downstream availability figure went with it.
/// </summary>
public class InventoryNegativeGuardTests
{
    [Fact]
    public async Task Adjust_BelowZero_IsRejectedAndLeavesRowUntouched()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-NEG", barcode: "BC-NEG");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();
        var service = new InventoryService(db);

        var act = () => service.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = plant.Id,
            DeltaQty = -50,
            Reason = "count"
        });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*below zero*");
        (await db.Inventories.AsNoTracking().FirstAsync(i => i.Id == inv.Id)).OnHandQty.Should().Be(10);
        (await db.InventoryAdjustments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Adjust_ToExactlyZero_IsAllowed()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-ZERO", barcode: "BC-ZERO");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        await db.SaveChangesAsync();
        var service = new InventoryService(db);

        var result = await service.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = plant.Id,
            DeltaQty = -10,
            Reason = "sold out"
        });

        result.OnHandQty.Should().Be(0);
    }

    [Fact]
    public async Task Set_NegativeQuantity_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(sku: "PLT-SET", barcode: "BC-SET");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        await db.SaveChangesAsync();
        var service = new InventoryService(db);

        var act = () => service.SetInventoryAsync(plant.Id, new UpdateInventoryRequest
        {
            OnHandQty = -1,
            Reason = "typo"
        });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*negative*");
        (await db.Inventories.AsNoTracking().FirstAsync(i => i.PlantCatalogId == plant.Id)).OnHandQty.Should().Be(10);
    }
}
