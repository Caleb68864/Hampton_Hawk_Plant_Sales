using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Services;

public class PlantInventoryCreationTests
{
    [Fact]
    public async Task CreatePlant_AutoCreatesInventoryWithZero()
    {
        using var db = MockDbContextFactory.Create();
        var plantService = new PlantService(db);

        var created = await plantService.CreateAsync(new CreatePlantRequest
        {
            Sku = "NEW-SKU",
            Name = "New Plant",
            Barcode = "NEW-BC",
            IsActive = true
        });

        var inventory = db.Inventories.Single(i => i.PlantCatalogId == created.Id);
        Assert.Equal(0, inventory.OnHandQty);
    }

    [Fact]
    public async Task InventorySetAndAdjust_WorkForApiCreatedPlant()
    {
        using var db = MockDbContextFactory.Create();
        var plantService = new PlantService(db);
        var inventoryService = new InventoryService(db);

        var created = await plantService.CreateAsync(new CreatePlantRequest
        {
            Sku = "NEW-SKU-2",
            Name = "Another Plant",
            Barcode = "NEW-BC-2",
            IsActive = true
        });

        var setResult = await inventoryService.SetInventoryAsync(created.Id, new UpdateInventoryRequest
        {
            OnHandQty = 50,
            Reason = "Initial count"
        });
        Assert.Equal(50, setResult.OnHandQty);

        var adjusted = await inventoryService.AdjustInventoryAsync(new AdjustInventoryRequest
        {
            PlantId = created.Id,
            DeltaQty = -5,
            Reason = "Damage"
        });
        Assert.Equal(45, adjusted.OnHandQty);
    }
}
