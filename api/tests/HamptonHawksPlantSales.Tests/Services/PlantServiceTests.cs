using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class PlantServiceTests
{
    // ── EP-24: List Plants with Search Filter ──────────────────────────

    [Fact]
    public async Task GetAllAsync_WithSearchTerm_ReturnsOnlyMatchingPlants()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Variant = "Red", Price = 12.50m, Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Variant = "Yellow", Price = 8.00m, Barcode = "1000000002", IsActive = true },
            new PlantCatalog { Sku = "PLT-003", Name = "Daisy Mix", Variant = "Assorted", Price = 6.75m, Barcode = "1000000003", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("Rose", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 10 });

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();
        result.Items[0].Name.Should().Be("Rose Bush");
    }

    [Fact]
    public async Task GetAllAsync_WithSearchTerm_PaginationMetadataIsCorrect()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Variant = "Red", Price = 12.50m, Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Variant = "Yellow", Price = 8.00m, Barcode = "1000000002", IsActive = true },
            new PlantCatalog { Sku = "PLT-003", Name = "Daisy Mix", Variant = "Assorted", Price = 6.75m, Barcode = "1000000003", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("Rose", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 10 });

        // Assert
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
        result.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task GetAllAsync_WithNonExistentSearchTerm_ReturnsEmptyList()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Variant = "Red", Price = 12.50m, Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Variant = "Yellow", Price = 8.00m, Barcode = "1000000002", IsActive = true },
            new PlantCatalog { Sku = "PLT-003", Name = "Daisy Mix", Variant = "Assorted", Price = 6.75m, Barcode = "1000000003", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("Orchid", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 10 });

        // Assert
        result.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAsync_WithNoFilter_ReturnsAllPlants()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Variant = "Red", Price = 12.50m, Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Variant = "Yellow", Price = 8.00m, Barcode = "1000000002", IsActive = true },
            new PlantCatalog { Sku = "PLT-003", Name = "Daisy Mix", Variant = "Assorted", Price = 6.75m, Barcode = "1000000003", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync(null, activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetAllAsync_SearchMatchesBySku()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Barcode = "1000000002", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("PLT-001", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items[0].Sku.Should().Be("PLT-001");
    }

    [Fact]
    public async Task GetAllAsync_SearchMatchesByBarcode()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Tulip Bulb", Barcode = "1000000002", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("1000000002", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items[0].Barcode.Should().Be("1000000002");
    }

    [Fact]
    public async Task GetAllAsync_WithLetterWildcard_FiltersByNameInitial()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.AddRange(
            new PlantCatalog { Sku = "PLT-001", Name = "Rose Bush", Barcode = "1000000001", IsActive = true },
            new PlantCatalog { Sku = "PLT-002", Name = "Ranunculus", Barcode = "1000000002", IsActive = true },
            new PlantCatalog { Sku = "PLT-003", Name = "Daisy Mix", Barcode = "1000000003", IsActive = true }
        );
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetAllAsync("R*", activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(2);
        result.Items.Should().AllSatisfy(item => item.Name.Should().StartWith("R"));
    }

    // ── EP-25: Get Plant by ID ─────────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WithValidId_ReturnsPlantWithAllFields()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog
        {
            Sku = "PLT-100",
            Name = "Lavender",
            Variant = "English",
            Price = 9.99m,
            Barcode = "2000000001",
            IsActive = true
        };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetByIdAsync(plant.Id);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(plant.Id);
        result.Sku.Should().Be("PLT-100");
        result.Name.Should().Be("Lavender");
        result.Variant.Should().Be("English");
        result.Price.Should().Be(9.99m);
        result.Barcode.Should().Be("2000000001");
        result.IsActive.Should().BeTrue();
        result.CreatedAt.Should().BeAfter(DateTimeOffset.MinValue);
        result.UpdatedAt.Should().BeAfter(DateTimeOffset.MinValue);
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistentId_ReturnsNull()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);

        // Act
        var result = await service.GetByIdAsync(Guid.NewGuid());

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_WithSoftDeletedPlant_ReturnsNull()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog
        {
            Sku = "PLT-DEL",
            Name = "Deleted Plant",
            Barcode = "DEL-BC-001",
            IsActive = true,
            DeletedAt = DateTimeOffset.UtcNow
        };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.GetByIdAsync(plant.Id);

        // Assert
        result.Should().BeNull();
    }

    // ── EP-26 (via Create): Create Plant with Auto Inventory ───────────

    [Fact]
    public async Task CreateAsync_WithValidRequest_ReturnsCreatedPlant()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);
        var request = new CreatePlantRequest
        {
            Sku = "PLT-NEW",
            Name = "Sunflower",
            Variant = "Giant",
            Price = 5.50m,
            Barcode = "3000000001",
            IsActive = true
        };

        // Act
        var result = await service.CreateAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().NotBe(Guid.Empty);
        result.Sku.Should().Be("PLT-NEW");
        result.Name.Should().Be("Sunflower");
        result.Variant.Should().Be("Giant");
        result.Price.Should().Be(5.50m);
        result.Barcode.Should().Be("3000000001");
        result.IsActive.Should().BeTrue();
        result.CreatedAt.Should().BeAfter(DateTimeOffset.MinValue);
    }

    [Fact]
    public async Task CreateAsync_AutoCreatesInventoryWithZeroQuantity()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);
        var request = new CreatePlantRequest
        {
            Sku = "PLT-INV",
            Name = "Inventory Test Plant",
            Barcode = "3000000002",
            IsActive = true
        };

        // Act
        var result = await service.CreateAsync(request);

        // Assert
        var inventory = await db.Inventories.FirstOrDefaultAsync(i => i.PlantCatalogId == result.Id);
        inventory.Should().NotBeNull();
        inventory!.OnHandQty.Should().Be(0);
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateSku_ThrowsValidationException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(new PlantCatalog { Sku = "PLT-DUP", Name = "Existing Plant", Barcode = "4000000001", IsActive = true });
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var request = new CreatePlantRequest
        {
            Sku = "PLT-DUP",
            Name = "Duplicate SKU Plant",
            Barcode = "4000000002",
            IsActive = true
        };

        // Act
        var act = () => service.CreateAsync(request);

        // Assert
        await act.Should().ThrowAsync<ValidationException>().WithMessage("*SKU*");
    }

    [Fact]
    public async Task CreateAsync_WithDuplicateBarcode_ThrowsValidationException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(new PlantCatalog { Sku = "PLT-BC1", Name = "Existing Plant", Barcode = "DUPE-BC", IsActive = true });
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var request = new CreatePlantRequest
        {
            Sku = "PLT-BC2",
            Name = "Duplicate Barcode Plant",
            Barcode = "DUPE-BC",
            IsActive = true
        };

        // Act
        var act = () => service.CreateAsync(request);

        // Assert
        await act.Should().ThrowAsync<ValidationException>().WithMessage("*Barcode*");
    }

    [Fact]
    public async Task CreateAsync_PlantIsPersisted()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);
        var request = new CreatePlantRequest
        {
            Sku = "PLT-PER",
            Name = "Persisted Plant",
            Barcode = "3000000003",
            IsActive = true
        };

        // Act
        var created = await service.CreateAsync(request);
        var retrieved = await service.GetByIdAsync(created.Id);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.Name.Should().Be("Persisted Plant");
        retrieved.Sku.Should().Be("PLT-PER");
    }

    // ── EP-27: Update Plant ────────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithValidRequest_UpdatesNameAndPrice()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = new PlantCatalog { Sku = "PLT-300", Name = "Petunia", Variant = "Purple", Price = 4.25m, Barcode = "4000000001", IsActive = true };
        var plantB = new PlantCatalog { Sku = "PLT-301", Name = "Marigold", Variant = "Orange", Price = 3.75m, Barcode = "4000000002", IsActive = true };
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-300",
            Name = "Petunia Deluxe",
            Variant = "Purple",
            Price = 5.99m,
            Barcode = "4000000001",
            IsActive = true
        };

        // Act
        var result = await service.UpdateAsync(plantA.Id, updateRequest);

        // Assert
        result.Name.Should().Be("Petunia Deluxe");
        result.Price.Should().Be(5.99m);
    }

    [Fact]
    public async Task UpdateAsync_ChangesPersisted_ConfirmedViaGetById()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog { Sku = "PLT-300", Name = "Petunia", Variant = "Purple", Price = 4.25m, Barcode = "4000000001", IsActive = true };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-300",
            Name = "Petunia Deluxe",
            Variant = "Purple",
            Price = 5.99m,
            Barcode = "4000000001",
            IsActive = true
        };

        // Act
        await service.UpdateAsync(plant.Id, updateRequest);
        var retrieved = await service.GetByIdAsync(plant.Id);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.Name.Should().Be("Petunia Deluxe");
        retrieved.Price.Should().Be(5.99m);
    }

    [Fact]
    public async Task UpdateAsync_WithDuplicateSku_ThrowsValidationException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = new PlantCatalog { Sku = "PLT-300", Name = "Petunia", Variant = "Purple", Price = 4.25m, Barcode = "4000000001", IsActive = true };
        var plantB = new PlantCatalog { Sku = "PLT-301", Name = "Marigold", Variant = "Orange", Price = 3.75m, Barcode = "4000000002", IsActive = true };
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-301", // Plant B's SKU
            Name = "Petunia",
            Variant = "Purple",
            Price = 4.25m,
            Barcode = "4000000001",
            IsActive = true
        };

        // Act
        var act = () => service.UpdateAsync(plantA.Id, updateRequest);

        // Assert
        await act.Should().ThrowAsync<ValidationException>().WithMessage("*SKU*");
    }

    [Fact]
    public async Task UpdateAsync_WithDuplicateBarcode_ThrowsValidationException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = new PlantCatalog { Sku = "PLT-300", Name = "Petunia", Variant = "Purple", Price = 4.25m, Barcode = "4000000001", IsActive = true };
        var plantB = new PlantCatalog { Sku = "PLT-301", Name = "Marigold", Variant = "Orange", Price = 3.75m, Barcode = "4000000002", IsActive = true };
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-300",
            Name = "Petunia",
            Variant = "Purple",
            Price = 4.25m,
            Barcode = "4000000002", // Plant B's Barcode
            IsActive = true
        };

        // Act
        var act = () => service.UpdateAsync(plantA.Id, updateRequest);

        // Assert
        await act.Should().ThrowAsync<ValidationException>().WithMessage("*Barcode*");
    }

    [Fact]
    public async Task UpdateAsync_WithSameOwnSku_DoesNotThrow()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog { Sku = "PLT-300", Name = "Petunia", Variant = "Purple", Price = 4.25m, Barcode = "4000000001", IsActive = true };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-300", // Same own SKU
            Name = "Petunia Updated",
            Variant = "Purple",
            Price = 6.00m,
            Barcode = "4000000001",
            IsActive = true
        };

        // Act
        var result = await service.UpdateAsync(plant.Id, updateRequest);

        // Assert
        result.Name.Should().Be("Petunia Updated");
        result.Price.Should().Be(6.00m);
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ThrowsKeyNotFoundException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);
        var updateRequest = new UpdatePlantRequest
        {
            Sku = "PLT-999",
            Name = "Ghost Plant",
            Barcode = "9999999999",
            IsActive = true
        };

        // Act
        var act = () => service.UpdateAsync(Guid.NewGuid(), updateRequest);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── EP-28: Soft Delete Plant ───────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_WithValidId_ReturnsTrue()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog { Sku = "PLT-400", Name = "Fern", Variant = "Boston", Price = 11.00m, Barcode = "5000000001", IsActive = true };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.DeleteAsync(plant.Id);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_SetsDeletedAtTimestamp()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog { Sku = "PLT-400", Name = "Fern", Variant = "Boston", Price = 11.00m, Barcode = "5000000001", IsActive = true };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);
        var beforeDelete = DateTimeOffset.UtcNow;

        // Act
        await service.DeleteAsync(plant.Id);

        // Assert
        var deletedPlant = await db.PlantCatalogs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == plant.Id);
        deletedPlant.Should().NotBeNull();
        deletedPlant!.DeletedAt.Should().NotBeNull();
        deletedPlant.DeletedAt.Should().BeOnOrAfter(beforeDelete);
    }

    [Fact]
    public async Task DeleteAsync_ExcludesFromDefaultQueries()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = new PlantCatalog { Sku = "PLT-400", Name = "Fern", Variant = "Boston", Price = 11.00m, Barcode = "5000000001", IsActive = true };
        var plantB = new PlantCatalog { Sku = "PLT-401", Name = "Cactus", Variant = "Barrel", Price = 7.50m, Barcode = "5000000002", IsActive = true };
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        await service.DeleteAsync(plantA.Id);
        var result = await service.GetAllAsync(null, activeOnly: null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();
        result.Items[0].Name.Should().Be("Cactus");
    }

    [Fact]
    public async Task DeleteAsync_IncludedWhenIncludeDeletedIsTrue()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plantA = new PlantCatalog { Sku = "PLT-400", Name = "Fern", Variant = "Boston", Price = 11.00m, Barcode = "5000000001", IsActive = true };
        var plantB = new PlantCatalog { Sku = "PLT-401", Name = "Cactus", Variant = "Barrel", Price = 7.50m, Barcode = "5000000002", IsActive = true };
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        await service.DeleteAsync(plantA.Id);
        var result = await service.GetAllAsync(null, activeOnly: null, includeDeleted: true, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(2);
        result.Items.Should().HaveCount(2);
        var deletedPlant = result.Items.First(p => p.Name == "Fern");
        deletedPlant.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentId_ReturnsFalse()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new PlantService(db);

        // Act
        var result = await service.DeleteAsync(Guid.NewGuid());

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_AlreadyDeletedPlant_ReturnsFalse()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var plant = new PlantCatalog
        {
            Sku = "PLT-GONE",
            Name = "Already Deleted",
            Barcode = "5000000003",
            IsActive = true,
            DeletedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        };
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = new PlantService(db);

        // Act
        var result = await service.DeleteAsync(plant.Id);

        // Assert
        result.Should().BeFalse();
    }
}
