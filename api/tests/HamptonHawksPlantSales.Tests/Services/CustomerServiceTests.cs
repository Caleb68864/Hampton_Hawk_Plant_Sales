using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class CustomerServiceTests
{
    [Fact]
    public async Task GetAll_WithLetterWildcard_FiltersByDisplayNameInitial()
    {
        using var db = MockDbContextFactory.Create();
        db.Customers.AddRange(
            new Customer { DisplayName = "DB01 TestCustomer", FirstName = "DB01", LastName = "TestCustomer", PickupCode = "ABC123" },
            new Customer { DisplayName = "Daisy Brown", FirstName = "Daisy", LastName = "Brown", PickupCode = "DEF456" },
            new Customer { DisplayName = "Alice Anderson", FirstName = "Alice", LastName = "Anderson", PickupCode = "GHI789" }
        );
        await db.SaveChangesAsync();

        var service = new CustomerService(db);
        var result = await service.GetAllAsync("D*", includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, item => Assert.StartsWith("D", item.DisplayName, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetAll_WithTextSearch_StillMatchesLastName()
    {
        using var db = MockDbContextFactory.Create();
        db.Customers.AddRange(
            new Customer { DisplayName = "Alpha User", FirstName = "Alpha", LastName = "Anderson", PickupCode = "JKL123" },
            new Customer { DisplayName = "Beta User", FirstName = "Beta", LastName = "Brown", PickupCode = "MNO456" }
        );
        await db.SaveChangesAsync();

        var service = new CustomerService(db);
        var result = await service.GetAllAsync("anderson", includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        Assert.Single(result.Items);
        Assert.Equal("Alpha User", result.Items[0].DisplayName);
    }

    // ── EP-30: Get Customer by ID ──────────────────────────────────────

    [Fact]
    public async Task GetByIdAsync_WithValidId_ReturnsCustomerWithAllFields()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Alice Walker",
            FirstName = "Alice",
            LastName = "Walker",
            Phone = "555-0201",
            Email = "alice.walker@example.com",
            PickupCode = "AWK001",
            Notes = "VIP customer"
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);

        // Act
        var result = await service.GetByIdAsync(customer.Id);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(customer.Id);
        result.DisplayName.Should().Be("Alice Walker");
        result.FirstName.Should().Be("Alice");
        result.LastName.Should().Be("Walker");
        result.Phone.Should().Be("555-0201");
        result.Email.Should().Be("alice.walker@example.com");
        result.Notes.Should().Be("VIP customer");
        result.CreatedAt.Should().BeAfter(DateTimeOffset.MinValue);
        result.UpdatedAt.Should().BeAfter(DateTimeOffset.MinValue);
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistentId_ReturnsNull()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);

        // Act
        var result = await service.GetByIdAsync(Guid.NewGuid());

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_WithSoftDeletedCustomer_ReturnsNull()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Deleted Customer",
            FirstName = "Del",
            LastName = "Eted",
            PickupCode = "DEL001",
            DeletedAt = DateTimeOffset.UtcNow
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);

        // Act
        var result = await service.GetByIdAsync(customer.Id);

        // Assert
        result.Should().BeNull();
    }

    // ── EP-31: Create Customer ─────────────────────────────────────────

    [Fact]
    public async Task CreateAsync_WithValidRequest_ReturnsCreatedCustomer()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var request = new CreateCustomerRequest
        {
            DisplayName = "Charlie Brown",
            FirstName = "Charlie",
            LastName = "Brown",
            Phone = "555-0301",
            Email = "charlie.brown@example.com",
            Notes = "Repeat buyer, prefers roses"
        };

        // Act
        var result = await service.CreateAsync(request);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().NotBe(Guid.Empty);
        result.DisplayName.Should().Be("Charlie Brown");
        result.FirstName.Should().Be("Charlie");
        result.LastName.Should().Be("Brown");
        result.Phone.Should().Be("555-0301");
        result.Email.Should().Be("charlie.brown@example.com");
        result.Notes.Should().Be("Repeat buyer, prefers roses");
        result.CreatedAt.Should().BeAfter(DateTimeOffset.MinValue);
    }

    [Fact]
    public async Task CreateAsync_GeneratesPickupCodeWhenNotProvided()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var request = new CreateCustomerRequest
        {
            DisplayName = "No Pickup Code",
            FirstName = "No",
            LastName = "Code"
        };

        // Act
        var result = await service.CreateAsync(request);

        // Assert
        result.PickupCode.Should().NotBeNullOrWhiteSpace();
        result.PickupCode.Should().HaveLength(6);
    }

    [Fact]
    public async Task CreateAsync_UsesProvidedPickupCode()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var request = new CreateCustomerRequest
        {
            DisplayName = "Custom Code",
            FirstName = "Custom",
            LastName = "Code",
            PickupCode = "MYCODE"
        };

        // Act
        var result = await service.CreateAsync(request);

        // Assert
        result.PickupCode.Should().Be("MYCODE");
    }

    [Fact]
    public async Task CreateAsync_CustomerIsPersisted()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var request = new CreateCustomerRequest
        {
            DisplayName = "Charlie Brown",
            FirstName = "Charlie",
            LastName = "Brown",
            Phone = "555-0301",
            Email = "charlie.brown@example.com",
            Notes = "Repeat buyer, prefers roses"
        };

        // Act
        var created = await service.CreateAsync(request);
        var retrieved = await service.GetByIdAsync(created.Id);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.DisplayName.Should().Be("Charlie Brown");
        retrieved.FirstName.Should().Be("Charlie");
        retrieved.LastName.Should().Be("Brown");
        retrieved.Phone.Should().Be("555-0301");
        retrieved.Email.Should().Be("charlie.brown@example.com");
    }

    [Fact]
    public async Task CreateAsync_CustomerAppearsInListing()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var request = new CreateCustomerRequest
        {
            DisplayName = "Listed Customer",
            FirstName = "Listed",
            LastName = "Customer"
        };

        // Act
        await service.CreateAsync(request);
        var listing = await service.GetAllAsync(null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        listing.TotalCount.Should().Be(1);
        listing.Items.Should().ContainSingle(c => c.DisplayName == "Listed Customer");
    }

    // ── EP-32: Update Customer ─────────────────────────────────────────

    [Fact]
    public async Task UpdateAsync_WithValidRequest_UpdatesPhoneAndEmail()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Dana White",
            FirstName = "Dana",
            LastName = "White",
            Phone = "555-0401",
            Email = "dana.white@example.com",
            PickupCode = "DWH001",
            Notes = "Original notes"
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);
        var updateRequest = new UpdateCustomerRequest
        {
            DisplayName = "Dana White",
            FirstName = "Dana",
            LastName = "White",
            Phone = "555-0499",
            Email = "dana.updated@example.com",
            Notes = "Original notes"
        };

        // Act
        var result = await service.UpdateAsync(customer.Id, updateRequest);

        // Assert
        result.Phone.Should().Be("555-0499");
        result.Email.Should().Be("dana.updated@example.com");
        result.DisplayName.Should().Be("Dana White");
        result.FirstName.Should().Be("Dana");
        result.LastName.Should().Be("White");
        result.Notes.Should().Be("Original notes");
    }

    [Fact]
    public async Task UpdateAsync_ChangesPersisted_ConfirmedViaGetById()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Dana White",
            FirstName = "Dana",
            LastName = "White",
            Phone = "555-0401",
            Email = "dana.white@example.com",
            PickupCode = "DWH002",
            Notes = "Original notes"
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);
        var updateRequest = new UpdateCustomerRequest
        {
            DisplayName = "Dana White",
            FirstName = "Dana",
            LastName = "White",
            Phone = "555-0499",
            Email = "dana.updated@example.com",
            Notes = "Original notes"
        };

        // Act
        await service.UpdateAsync(customer.Id, updateRequest);
        var retrieved = await service.GetByIdAsync(customer.Id);

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.Phone.Should().Be("555-0499");
        retrieved.Email.Should().Be("dana.updated@example.com");
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ThrowsKeyNotFoundException()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);
        var updateRequest = new UpdateCustomerRequest
        {
            DisplayName = "Ghost Customer",
            FirstName = "Ghost",
            LastName = "Customer"
        };

        // Act
        var act = () => service.UpdateAsync(Guid.NewGuid(), updateRequest);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ── EP-33: Soft Delete Customer ────────────────────────────────────

    [Fact]
    public async Task DeleteAsync_WithValidId_ReturnsTrue()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Eve Adams",
            FirstName = "Eve",
            LastName = "Adams",
            Phone = "555-0501",
            Email = "eve@example.com",
            PickupCode = "EVE001",
            Notes = ""
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);

        // Act
        var result = await service.DeleteAsync(customer.Id);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_SetsDeletedAtTimestamp()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customer = new Customer
        {
            DisplayName = "Eve Adams",
            FirstName = "Eve",
            LastName = "Adams",
            Phone = "555-0501",
            Email = "eve@example.com",
            PickupCode = "EVE002",
            Notes = ""
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);
        var beforeDelete = DateTimeOffset.UtcNow;

        // Act
        await service.DeleteAsync(customer.Id);

        // Assert
        var deletedCustomer = await db.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == customer.Id);
        deletedCustomer.Should().NotBeNull();
        deletedCustomer!.DeletedAt.Should().NotBeNull();
        deletedCustomer.DeletedAt.Should().BeOnOrAfter(beforeDelete);
    }

    [Fact]
    public async Task DeleteAsync_ExcludesFromDefaultQueries()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customerA = new Customer
        {
            DisplayName = "Eve Adams",
            FirstName = "Eve",
            LastName = "Adams",
            Phone = "555-0501",
            Email = "eve@example.com",
            PickupCode = "EVE003",
            Notes = ""
        };
        var customerB = new Customer
        {
            DisplayName = "Frank Lee",
            FirstName = "Frank",
            LastName = "Lee",
            Phone = "555-0502",
            Email = "frank@example.com",
            PickupCode = "FRK001",
            Notes = ""
        };
        db.Customers.AddRange(customerA, customerB);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);

        // Act
        await service.DeleteAsync(customerA.Id);
        var result = await service.GetAllAsync(null, includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();
        result.Items[0].DisplayName.Should().Be("Frank Lee");
    }

    [Fact]
    public async Task DeleteAsync_IncludedWhenIncludeDeletedIsTrue()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var customerA = new Customer
        {
            DisplayName = "Eve Adams",
            FirstName = "Eve",
            LastName = "Adams",
            Phone = "555-0501",
            Email = "eve@example.com",
            PickupCode = "EVE004",
            Notes = ""
        };
        var customerB = new Customer
        {
            DisplayName = "Frank Lee",
            FirstName = "Frank",
            LastName = "Lee",
            Phone = "555-0502",
            Email = "frank@example.com",
            PickupCode = "FRK002",
            Notes = ""
        };
        db.Customers.AddRange(customerA, customerB);
        await db.SaveChangesAsync();

        var service = new CustomerService(db);

        // Act
        await service.DeleteAsync(customerA.Id);
        var result = await service.GetAllAsync(null, includeDeleted: true, new PaginationParams { Page = 1, PageSize = 25 });

        // Assert
        result.TotalCount.Should().Be(2);
        result.Items.Should().HaveCount(2);
        var deletedCustomer = result.Items.First(c => c.DisplayName == "Eve Adams");
        deletedCustomer.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentId_ReturnsFalse()
    {
        // Arrange
        using var db = MockDbContextFactory.Create();
        var service = new CustomerService(db);

        // Act
        var result = await service.DeleteAsync(Guid.NewGuid());

        // Assert
        result.Should().BeFalse();
    }
}
