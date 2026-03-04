using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// Tests that soft-delete (setting DeletedAt) works correctly across all entity types.
/// Covers scenarios DB-09, DB-10, SR-06, and SR-07.
/// </summary>
public class SoftDeleteTests
{
    private static readonly PaginationParams DefaultPaging = new() { Page = 1, PageSize = 50 };

    private static AppDbContext CreateDb() => MockDbContextFactory.Create();

    private static PlantService CreatePlantService(AppDbContext db) => new(db);

    private static CustomerService CreateCustomerService(AppDbContext db) => new(db);

    private static SellerService CreateSellerService(AppDbContext db) => new(db);

    private static OrderService CreateOrderService(AppDbContext db)
    {
        var protection = new Mock<IInventoryProtectionService>();
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = "1234" })
            .Build();

        return new OrderService(db, protection.Object, admin.Object, config);
    }

    // ---------------------------------------------------------------
    // DB-09 / SR-06: Soft-delete global filter -- per entity type
    // ---------------------------------------------------------------

    #region Plant soft delete

    [Fact]
    public async Task DB09_Plant_SoftDelete_ExcludedFromDefaultQuery()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);
        var created = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-DEL-001", Name = "Deletable Plant", Barcode = "BC-DEL-001"
        });

        // Verify visible before delete
        var beforeDelete = await service.GetAllAsync(null, null, false, DefaultPaging);
        beforeDelete.Items.Should().ContainSingle(p => p.Id == created.Id);

        // Act
        var deleted = await service.DeleteAsync(created.Id);
        deleted.Should().BeTrue();

        // Assert -- excluded from default query
        var afterDelete = await service.GetAllAsync(null, null, false, DefaultPaging);
        afterDelete.Items.Should().NotContain(p => p.Id == created.Id);
    }

    [Fact]
    public async Task DB09_Plant_SoftDelete_IncludedWithIncludeDeletedTrue()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);
        var created = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-DEL-002", Name = "Deletable Plant 2", Barcode = "BC-DEL-002"
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, null, true, DefaultPaging);

        // Assert
        result.Items.Should().ContainSingle(p => p.Id == created.Id);
        var deletedPlant = result.Items.First(p => p.Id == created.Id);
        deletedPlant.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SR06_Plant_GetById_ReturnsNull_ForDeletedEntity()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);
        var created = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-DEL-003", Name = "Deletable Plant 3", Barcode = "BC-DEL-003"
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetByIdAsync(created.Id);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task SR06_Plant_GetById_ReturnsEntity_ForActiveEntity()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);
        var plantA = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-A-ACTIVE", Name = "Active Plant A", Barcode = "BC-A-ACTIVE"
        });
        var plantB = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-B-DEL", Name = "Deleted Plant B", Barcode = "BC-B-DEL"
        });

        await service.DeleteAsync(plantA.Id);

        // Act
        var activeResult = await service.GetByIdAsync(plantB.Id);
        var deletedResult = await service.GetByIdAsync(plantA.Id);

        // Assert
        activeResult.Should().NotBeNull();
        activeResult!.Id.Should().Be(plantB.Id);
        deletedResult.Should().BeNull();
    }

    #endregion

    #region Customer soft delete

    [Fact]
    public async Task DB09_Customer_SoftDelete_ExcludedFromDefaultQuery()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateCustomerService(db);
        var created = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Test Customer" });

        var beforeDelete = await service.GetAllAsync(null, false, DefaultPaging);
        beforeDelete.Items.Should().ContainSingle(c => c.Id == created.Id);

        // Act
        var deleted = await service.DeleteAsync(created.Id);
        deleted.Should().BeTrue();

        // Assert
        var afterDelete = await service.GetAllAsync(null, false, DefaultPaging);
        afterDelete.Items.Should().NotContain(c => c.Id == created.Id);
    }

    [Fact]
    public async Task DB09_Customer_SoftDelete_IncludedWithIncludeDeletedTrue()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateCustomerService(db);
        var created = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Test Customer 2" });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        result.Items.Should().ContainSingle(c => c.Id == created.Id);
        result.Items.First(c => c.Id == created.Id).DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SR06_Customer_GetById_ReturnsNull_ForDeletedEntity()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateCustomerService(db);
        var created = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Deletable Customer" });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetByIdAsync(created.Id);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region Seller soft delete

    [Fact]
    public async Task DB09_Seller_SoftDelete_ExcludedFromDefaultQuery()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateSellerService(db);
        var created = await service.CreateAsync(new CreateSellerRequest { DisplayName = "Test Seller" });

        var beforeDelete = await service.GetAllAsync(null, false, DefaultPaging);
        beforeDelete.Items.Should().ContainSingle(s => s.Id == created.Id);

        // Act
        var deleted = await service.DeleteAsync(created.Id);
        deleted.Should().BeTrue();

        // Assert
        var afterDelete = await service.GetAllAsync(null, false, DefaultPaging);
        afterDelete.Items.Should().NotContain(s => s.Id == created.Id);
    }

    [Fact]
    public async Task DB09_Seller_SoftDelete_IncludedWithIncludeDeletedTrue()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateSellerService(db);
        var created = await service.CreateAsync(new CreateSellerRequest { DisplayName = "Test Seller 2" });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        result.Items.Should().ContainSingle(s => s.Id == created.Id);
        result.Items.First(s => s.Id == created.Id).DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SR06_Seller_GetById_ReturnsNull_ForDeletedEntity()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateSellerService(db);
        var created = await service.CreateAsync(new CreateSellerRequest { DisplayName = "Deletable Seller" });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetByIdAsync(created.Id);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region Order soft delete

    [Fact]
    public async Task DB09_Order_SoftDelete_ExcludedFromDefaultQuery()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateOrderService(db);
        var customer = TestDataBuilder.CreateCustomer("Order Test Customer");
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false
        });

        var beforeDelete = await service.GetAllAsync(null, null, null, null, null, false, DefaultPaging);
        beforeDelete.Items.Should().ContainSingle(o => o.Id == created.Id);

        // Act
        var deleted = await service.DeleteAsync(created.Id);
        deleted.Should().BeTrue();

        // Assert
        var afterDelete = await service.GetAllAsync(null, null, null, null, null, false, DefaultPaging);
        afterDelete.Items.Should().NotContain(o => o.Id == created.Id);
    }

    [Fact]
    public async Task DB09_Order_SoftDelete_IncludedWithIncludeDeletedTrue()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateOrderService(db);
        var customer = TestDataBuilder.CreateCustomer("Order Test Customer 2");
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, null, null, null, null, true, DefaultPaging);

        // Assert
        result.Items.Should().ContainSingle(o => o.Id == created.Id);
        result.Items.First(o => o.Id == created.Id).DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SR06_Order_GetById_ReturnsNull_ForDeletedEntity()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateOrderService(db);
        var customer = TestDataBuilder.CreateCustomer("Order GetById Customer");
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetByIdAsync(created.Id);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    // ---------------------------------------------------------------
    // DB-10 / SR-07: Mixed data -- IgnoreQueryFilters includes deleted
    // ---------------------------------------------------------------

    [Fact]
    public async Task DB10_MixedPlants_DefaultExcludesDeleted_IncludeDeletedReturnsAll()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);

        var plantA = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-MIX-A", Name = "Plant A Active", Barcode = "BC-MIX-A"
        });
        var plantB = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-MIX-B", Name = "Plant B Deleted", Barcode = "BC-MIX-B"
        });
        var plantC = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-MIX-C", Name = "Plant C Active", Barcode = "BC-MIX-C"
        });

        await service.DeleteAsync(plantB.Id);

        // Act
        var defaultResult = await service.GetAllAsync(null, null, false, DefaultPaging);
        var includeDeletedResult = await service.GetAllAsync(null, null, true, DefaultPaging);

        // Assert
        defaultResult.Items.Should().HaveCount(2);
        defaultResult.Items.Should().NotContain(p => p.Id == plantB.Id);
        defaultResult.Items.Select(p => p.Id).Should().Contain(new[] { plantA.Id, plantC.Id });

        includeDeletedResult.Items.Should().HaveCount(3);
        var deletedPlant = includeDeletedResult.Items.First(p => p.Id == plantB.Id);
        deletedPlant.DeletedAt.Should().NotBeNull();

        // Active plants should have null DeletedAt
        includeDeletedResult.Items.First(p => p.Id == plantA.Id).DeletedAt.Should().BeNull();
        includeDeletedResult.Items.First(p => p.Id == plantC.Id).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task DB10_MixedCustomers_DefaultExcludesDeleted_IncludeDeletedReturnsAll()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateCustomerService(db);

        var custA = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Customer A" });
        var custB = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Customer B" });
        var custC = await service.CreateAsync(new CreateCustomerRequest { DisplayName = "Customer C" });

        await service.DeleteAsync(custC.Id);

        // Act
        var defaultResult = await service.GetAllAsync(null, false, DefaultPaging);
        var includeDeletedResult = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        defaultResult.Items.Should().HaveCount(2);
        defaultResult.Items.Should().NotContain(c => c.Id == custC.Id);

        includeDeletedResult.Items.Should().HaveCount(3);
        includeDeletedResult.Items.First(c => c.Id == custC.Id).DeletedAt.Should().NotBeNull();
        includeDeletedResult.Items.First(c => c.Id == custA.Id).DeletedAt.Should().BeNull();
        includeDeletedResult.Items.First(c => c.Id == custB.Id).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task DB10_MixedSellers_DefaultExcludesDeleted_IncludeDeletedReturnsAll()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateSellerService(db);

        var sellerA = await service.CreateAsync(new CreateSellerRequest { DisplayName = "Seller A" });
        var sellerB = await service.CreateAsync(new CreateSellerRequest { DisplayName = "Seller B" });

        await service.DeleteAsync(sellerB.Id);

        // Act
        var defaultResult = await service.GetAllAsync(null, false, DefaultPaging);
        var includeDeletedResult = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        defaultResult.Items.Should().HaveCount(1);
        defaultResult.Items.Should().NotContain(s => s.Id == sellerB.Id);

        includeDeletedResult.Items.Should().HaveCount(2);
        includeDeletedResult.Items.First(s => s.Id == sellerB.Id).DeletedAt.Should().NotBeNull();
        includeDeletedResult.Items.First(s => s.Id == sellerA.Id).DeletedAt.Should().BeNull();
    }

    [Fact]
    public async Task DB10_CountsMatch_DefaultPlusDeletedEqualsIncludeDeletedTotal()
    {
        // Arrange
        using var db = CreateDb();
        var plantService = CreatePlantService(db);

        await plantService.CreateAsync(new CreatePlantRequest { Sku = "PLT-CNT-1", Name = "Count 1", Barcode = "BC-CNT-1" });
        var toDelete1 = await plantService.CreateAsync(new CreatePlantRequest { Sku = "PLT-CNT-2", Name = "Count 2", Barcode = "BC-CNT-2" });
        await plantService.CreateAsync(new CreatePlantRequest { Sku = "PLT-CNT-3", Name = "Count 3", Barcode = "BC-CNT-3" });
        var toDelete2 = await plantService.CreateAsync(new CreatePlantRequest { Sku = "PLT-CNT-4", Name = "Count 4", Barcode = "BC-CNT-4" });
        await plantService.CreateAsync(new CreatePlantRequest { Sku = "PLT-CNT-5", Name = "Count 5", Barcode = "BC-CNT-5" });

        await plantService.DeleteAsync(toDelete1.Id);
        await plantService.DeleteAsync(toDelete2.Id);

        // Act
        var defaultResult = await plantService.GetAllAsync(null, null, false, DefaultPaging);
        var includeDeletedResult = await plantService.GetAllAsync(null, null, true, DefaultPaging);

        // Assert
        var activeCount = defaultResult.TotalCount;
        var totalCount = includeDeletedResult.TotalCount;
        var deletedCount = includeDeletedResult.Items.Count(p => p.DeletedAt != null);

        activeCount.Should().Be(3);
        deletedCount.Should().Be(2);
        (activeCount + deletedCount).Should().Be(totalCount);
    }

    // ---------------------------------------------------------------
    // SR-07: includeDeleted=false is same as default behavior
    // ---------------------------------------------------------------

    [Fact]
    public async Task SR07_IncludeDeletedFalse_SameAsDefaultBehavior()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);

        await service.CreateAsync(new CreatePlantRequest { Sku = "PLT-FDEF-1", Name = "F Default 1", Barcode = "BC-FDEF-1" });
        var toDelete = await service.CreateAsync(new CreatePlantRequest { Sku = "PLT-FDEF-2", Name = "F Default 2", Barcode = "BC-FDEF-2" });
        await service.CreateAsync(new CreatePlantRequest { Sku = "PLT-FDEF-3", Name = "F Default 3", Barcode = "BC-FDEF-3" });

        await service.DeleteAsync(toDelete.Id);

        // Act
        var defaultResult = await service.GetAllAsync(null, null, false, DefaultPaging);
        // includeDeleted=false is explicitly passed -- same behavior as default
        var explicitFalse = await service.GetAllAsync(null, null, false, DefaultPaging);

        // Assert
        defaultResult.Items.Should().HaveCount(2);
        explicitFalse.Items.Should().HaveCount(2);
        defaultResult.TotalCount.Should().Be(explicitFalse.TotalCount);
    }

    // ---------------------------------------------------------------
    // SR-07: Data integrity preserved on soft-deleted records
    // ---------------------------------------------------------------

    [Fact]
    public async Task SR07_DeletedRecordsPreserveAllFields()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreatePlantService(db);
        var created = await service.CreateAsync(new CreatePlantRequest
        {
            Sku = "PLT-PRESERVE", Name = "Preserved Plant", Barcode = "BC-PRESERVE", Price = 9.99m, IsActive = true
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, null, true, DefaultPaging);

        // Assert
        var deletedPlant = result.Items.First(p => p.Id == created.Id);
        deletedPlant.DeletedAt.Should().NotBeNull();
        deletedPlant.CreatedAt.Should().NotBe(default);
        deletedPlant.UpdatedAt.Should().NotBe(default);
        deletedPlant.Sku.Should().Be("PLT-PRESERVE");
        deletedPlant.Name.Should().Be("Preserved Plant");
        deletedPlant.Barcode.Should().Be("BC-PRESERVE");
        deletedPlant.Price.Should().Be(9.99m);
        deletedPlant.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task SR07_DeletedCustomerPreservesAllFields()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateCustomerService(db);
        var created = await service.CreateAsync(new CreateCustomerRequest
        {
            DisplayName = "Preserved Customer",
            FirstName = "John",
            LastName = "Doe",
            Phone = "555-1234",
            Email = "john@example.com"
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        var deletedCustomer = result.Items.First(c => c.Id == created.Id);
        deletedCustomer.DeletedAt.Should().NotBeNull();
        deletedCustomer.CreatedAt.Should().NotBe(default);
        deletedCustomer.UpdatedAt.Should().NotBe(default);
        deletedCustomer.DisplayName.Should().Be("Preserved Customer");
        deletedCustomer.FirstName.Should().Be("John");
        deletedCustomer.LastName.Should().Be("Doe");
        deletedCustomer.Phone.Should().Be("555-1234");
        deletedCustomer.Email.Should().Be("john@example.com");
    }

    [Fact]
    public async Task SR07_DeletedSellerPreservesAllFields()
    {
        // Arrange
        using var db = CreateDb();
        var service = CreateSellerService(db);
        var created = await service.CreateAsync(new CreateSellerRequest
        {
            DisplayName = "Preserved Seller",
            FirstName = "Jane",
            LastName = "Smith",
            Grade = "5th",
            Teacher = "Mrs. Brown"
        });

        await service.DeleteAsync(created.Id);

        // Act
        var result = await service.GetAllAsync(null, true, DefaultPaging);

        // Assert
        var deletedSeller = result.Items.First(s => s.Id == created.Id);
        deletedSeller.DeletedAt.Should().NotBeNull();
        deletedSeller.CreatedAt.Should().NotBe(default);
        deletedSeller.UpdatedAt.Should().NotBe(default);
        deletedSeller.DisplayName.Should().Be("Preserved Seller");
        deletedSeller.FirstName.Should().Be("Jane");
        deletedSeller.LastName.Should().Be("Smith");
        deletedSeller.Grade.Should().Be("5th");
        deletedSeller.Teacher.Should().Be("Mrs. Brown");
    }
}
