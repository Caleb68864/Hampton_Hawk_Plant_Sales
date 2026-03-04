using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class InventoryServiceTests
{
    // ── EP-39: List Inventory with Search and Plant Info ──

    [Fact]
    public async Task GetAllAsync_SearchByName_ReturnsMatchingRecords()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        var plantB = TestDataBuilder.CreatePlant(name: "Tulip Bulb", sku: "PLT-501", barcode: "BC-501");
        var plantC = TestDataBuilder.CreatePlant(name: "Daisy Mix", sku: "PLT-502", barcode: "BC-502");

        db.PlantCatalogs.AddRange(plantA, plantB, plantC);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantA.Id, onHandQty: 20));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantB.Id, onHandQty: 50));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantC.Id, onHandQty: 30));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 25 };

        // Act
        var result = await service.GetAllAsync("Rose", paging);

        // Assert
        result.Items.Should().HaveCount(1);
        result.TotalCount.Should().Be(1);
        var item = result.Items[0];
        item.PlantName.Should().Be("Rose Bush");
        item.PlantSku.Should().Be("PLT-500");
        item.OnHandQty.Should().Be(20);
    }

    [Fact]
    public async Task GetAllAsync_SearchBySku_ReturnsMatchingRecords()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        var plantB = TestDataBuilder.CreatePlant(name: "Tulip Bulb", sku: "PLT-501", barcode: "BC-501");

        db.PlantCatalogs.AddRange(plantA, plantB);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantA.Id, onHandQty: 20));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantB.Id, onHandQty: 50));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 25 };

        // Act
        var result = await service.GetAllAsync("PLT-501", paging);

        // Assert
        result.Items.Should().HaveCount(1);
        result.Items[0].PlantSku.Should().Be("PLT-501");
        result.Items[0].OnHandQty.Should().Be(50);
    }

    [Fact]
    public async Task GetAllAsync_PaginationMetadataIsCorrect()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        var plantB = TestDataBuilder.CreatePlant(name: "Tulip Bulb", sku: "PLT-501", barcode: "BC-501");
        var plantC = TestDataBuilder.CreatePlant(name: "Daisy Mix", sku: "PLT-502", barcode: "BC-502");

        db.PlantCatalogs.AddRange(plantA, plantB, plantC);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantA.Id, onHandQty: 20));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantB.Id, onHandQty: 50));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantC.Id, onHandQty: 30));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 2 };

        // Act
        var result = await service.GetAllAsync(null, paging);

        // Assert
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(3);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(2);
        result.TotalPages.Should().Be(2);
    }

    [Fact]
    public async Task GetAllAsync_NoSearch_ReturnsAllRecords()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        var plantB = TestDataBuilder.CreatePlant(name: "Tulip Bulb", sku: "PLT-501", barcode: "BC-501");
        var plantC = TestDataBuilder.CreatePlant(name: "Daisy Mix", sku: "PLT-502", barcode: "BC-502");

        db.PlantCatalogs.AddRange(plantA, plantB, plantC);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantA.Id, onHandQty: 20));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantB.Id, onHandQty: 50));
        db.Inventories.Add(TestDataBuilder.CreateInventory(plantC.Id, onHandQty: 30));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 25 };

        // Act
        var result = await service.GetAllAsync(null, paging);

        // Assert
        result.Items.Should().HaveCount(3);
        result.TotalCount.Should().Be(3);
    }

    [Fact]
    public async Task GetAllAsync_SearchWithNoMatch_ReturnsEmpty()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 20));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 25 };

        // Act
        var result = await service.GetAllAsync("Orchid", paging);

        // Assert
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetAllAsync_IncludesPlantCatalogFields()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Rose Bush", sku: "PLT-500", barcode: "BC-500");
        db.PlantCatalogs.Add(plant);
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 20);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var service = new InventoryService(db);
        var paging = new PaginationParams { Page = 1, PageSize = 25 };

        // Act
        var result = await service.GetAllAsync(null, paging);

        // Assert
        var item = result.Items.Should().ContainSingle().Subject;
        item.Id.Should().NotBeEmpty();
        item.PlantCatalogId.Should().Be(plant.Id);
        item.PlantName.Should().Be("Rose Bush");
        item.PlantSku.Should().Be("PLT-500");
        item.OnHandQty.Should().Be(20);
        item.CreatedAt.Should().NotBe(default);
    }

    // ── DB-07: Inventory Adjustment Audit Trail ──

    [Fact]
    public async Task SetInventoryAsync_CreatesAuditTrailEntry()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Orchid", sku: "PLT-800", barcode: "BC-800");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 15));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);

        // Act
        var result = await service.SetInventoryAsync(plant.Id, new UpdateInventoryRequest
        {
            OnHandQty = 50,
            Reason = "Initial stock count"
        });

        // Assert
        result.OnHandQty.Should().Be(50);

        var adjustments = await db.InventoryAdjustments
            .Where(a => a.PlantCatalogId == plant.Id)
            .ToListAsync();

        adjustments.Should().HaveCount(1);
        var adj = adjustments[0];
        adj.DeltaQty.Should().Be(35); // 50 - 15
        adj.Reason.Should().Be("Initial stock count");
        adj.CreatedAt.Should().NotBe(default);
    }

    [Fact]
    public async Task AdjustInventoryAsync_CreatesAuditTrailEntry()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Orchid", sku: "PLT-800", barcode: "BC-800");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 50));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);

        // Act
        var result = await service.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = plant.Id,
            DeltaQty = -5,
            Reason = "Sold at walk-up"
        });

        // Assert
        result.OnHandQty.Should().Be(45);

        var adjustments = await db.InventoryAdjustments
            .Where(a => a.PlantCatalogId == plant.Id)
            .ToListAsync();

        adjustments.Should().HaveCount(1);
        var adj = adjustments[0];
        adj.DeltaQty.Should().Be(-5);
        adj.Reason.Should().Be("Sold at walk-up");
    }

    [Fact]
    public async Task SequentialOperations_CreateChronologicalAuditTrail()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Orchid", sku: "PLT-800", barcode: "BC-800");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 15));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);

        // Act: SetInventory 15 -> 50
        await service.SetInventoryAsync(plant.Id, new UpdateInventoryRequest
        {
            OnHandQty = 50,
            Reason = "Initial stock count"
        });

        // Act: AdjustInventory -5 (50 -> 45)
        await service.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = plant.Id,
            DeltaQty = -5,
            Reason = "Sold at walk-up"
        });

        // Act: AdjustInventory +10 (45 -> 55)
        await service.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = plant.Id,
            DeltaQty = 10,
            Reason = "Delivery received"
        });

        // Assert: 3 audit entries in chronological order
        var adjustments = await db.InventoryAdjustments
            .Where(a => a.PlantCatalogId == plant.Id)
            .OrderBy(a => a.CreatedAt)
            .ToListAsync();

        adjustments.Should().HaveCount(3);

        // Adjustment 1: Set from 15 to 50
        adjustments[0].DeltaQty.Should().Be(35);
        adjustments[0].Reason.Should().Be("Initial stock count");

        // Adjustment 2: Adjust -5
        adjustments[1].DeltaQty.Should().Be(-5);
        adjustments[1].Reason.Should().Be("Sold at walk-up");

        // Adjustment 3: Adjust +10
        adjustments[2].DeltaQty.Should().Be(10);
        adjustments[2].Reason.Should().Be("Delivery received");

        // Verify final inventory state
        var inventory = await db.Inventories.FirstAsync(i => i.PlantCatalogId == plant.Id);
        inventory.OnHandQty.Should().Be(55);
    }

    [Fact]
    public async Task SetInventoryAsync_NotesAreStoredInAdjustment()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(name: "Orchid", sku: "PLT-800", barcode: "BC-800");
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        await db.SaveChangesAsync();

        var service = new InventoryService(db);

        // Act
        await service.SetInventoryAsync(plant.Id, new UpdateInventoryRequest
        {
            OnHandQty = 25,
            Reason = "Recount",
            Notes = "Double-checked against physical count"
        });

        // Assert
        var adj = await db.InventoryAdjustments.SingleAsync(a => a.PlantCatalogId == plant.Id);
        adj.Notes.Should().Be("Double-checked against physical count");
    }

    [Fact]
    public async Task SetInventoryAsync_PlantNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new InventoryService(db);

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.SetInventoryAsync(Guid.NewGuid(), new UpdateInventoryRequest
            {
                OnHandQty = 10,
                Reason = "test"
            }));
    }

    [Fact]
    public async Task AdjustInventoryAsync_PlantNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new InventoryService(db);

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.AdjustInventoryAsync(new AdjustInventoryRequest
            {
                PlantId = Guid.NewGuid(),
                DeltaQty = 5,
                Reason = "test"
            }));
    }
}
