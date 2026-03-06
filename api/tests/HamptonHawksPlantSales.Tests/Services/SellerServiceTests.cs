using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Services;

public class SellerServiceTests
{
    // ── EP-34: List sellers with search ──

    [Fact]
    public async Task GetAll_WithLetterWildcard_FiltersByDisplayNameInitial()
    {
        using var db = MockDbContextFactory.Create();
        db.Sellers.AddRange(
            new Seller { DisplayName = "Sam Seller", FirstName = "Sam", LastName = "Seller" },
            new Seller { DisplayName = "SR07 Seller", FirstName = "SR07", LastName = "Seller" },
            new Seller { DisplayName = "Alex Seller", FirstName = "Alex", LastName = "Seller" }
        );
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        var result = await service.GetAllAsync("S*", includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        Assert.Equal(2, result.TotalCount);
        Assert.All(result.Items, item => Assert.StartsWith("S", item.DisplayName, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task GetAll_WithTextSearch_MatchesDisplayNameAndLastName()
    {
        using var db = MockDbContextFactory.Create();
        db.Sellers.AddRange(
            new Seller { DisplayName = "Taylor Jordan", FirstName = "Taylor", LastName = "Jordan" },
            new Seller { DisplayName = "Morgan Lee", FirstName = "Morgan", LastName = "Lee" }
        );
        await db.SaveChangesAsync();

        var service = new SellerService(db);

        var byDisplayName = await service.GetAllAsync("tay", includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });
        var byLastName = await service.GetAllAsync("lee", includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        Assert.Single(byDisplayName.Items);
        Assert.Equal("Taylor Jordan", byDisplayName.Items[0].DisplayName);

        Assert.Single(byLastName.Items);
        Assert.Equal("Morgan Lee", byLastName.Items[0].DisplayName);
    }

    // ── EP-35: Get seller by ID ──

    [Fact]
    public async Task GetByIdAsync_WithValidId_ReturnsSellerWithAllFields()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller
        {
            DisplayName = "Lily Chen",
            FirstName = "Lily",
            LastName = "Chen",
            Grade = "5th",
            Teacher = "Ms. Thompson",
            Notes = "Award winner last year"
        };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        var result = await service.GetByIdAsync(seller.Id);

        result.Should().NotBeNull();
        result!.Id.Should().Be(seller.Id);
        result.DisplayName.Should().Be("Lily Chen");
        result.FirstName.Should().Be("Lily");
        result.LastName.Should().Be("Chen");
        result.Grade.Should().Be("5th");
        result.Teacher.Should().Be("Ms. Thompson");
        result.Notes.Should().Be("Award winner last year");
        result.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task GetByIdAsync_WithNonExistentId_ReturnsNull()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        var result = await service.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_WithSoftDeletedSeller_ReturnsNull()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller { DisplayName = "Deleted Seller", DeletedAt = DateTimeOffset.UtcNow };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        var result = await service.GetByIdAsync(seller.Id);

        result.Should().BeNull();
    }

    // ── EP-36: Create seller ──

    [Fact]
    public async Task CreateAsync_WithValidRequest_ReturnsCreatedSeller()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        var result = await service.CreateAsync(new CreateSellerRequest
        {
            DisplayName = "Noah Patel",
            FirstName = "Noah",
            LastName = "Patel",
            Grade = "2nd",
            Teacher = "Mr. Wallace",
            Notes = "First time seller"
        });

        result.Should().NotBeNull();
        result.Id.Should().NotBe(Guid.Empty);
        result.DisplayName.Should().Be("Noah Patel");
        result.FirstName.Should().Be("Noah");
        result.LastName.Should().Be("Patel");
        result.Grade.Should().Be("2nd");
        result.Teacher.Should().Be("Mr. Wallace");
        result.Notes.Should().Be("First time seller");
        result.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task CreateAsync_SellerAppearsInListing()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        var created = await service.CreateAsync(new CreateSellerRequest
        {
            DisplayName = "Test Seller",
            FirstName = "Test",
            LastName = "Seller"
        });

        var listing = await service.GetAllAsync(null, false, new PaginationParams { Page = 1, PageSize = 25 });
        listing.Items.Should().ContainSingle(s => s.Id == created.Id);
    }

    [Fact]
    public async Task CreateAsync_SellerIsPersisted()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        var created = await service.CreateAsync(new CreateSellerRequest
        {
            DisplayName = "Persisted Seller",
            FirstName = "Per",
            LastName = "Sisted"
        });

        var fetched = await service.GetByIdAsync(created.Id);
        fetched.Should().NotBeNull();
        fetched!.DisplayName.Should().Be("Persisted Seller");
    }

    // ── EP-37: Update seller ──

    [Fact]
    public async Task UpdateAsync_WithValidRequest_UpdatesGradeAndTeacher()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller
        {
            DisplayName = "Olivia Grant",
            FirstName = "Olivia",
            LastName = "Grant",
            Grade = "3rd",
            Teacher = "Mrs. Baker",
            Notes = "Enthusiastic"
        };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        var result = await service.UpdateAsync(seller.Id, new UpdateSellerRequest
        {
            DisplayName = "Olivia Grant",
            FirstName = "Olivia",
            LastName = "Grant",
            Grade = "4th",
            Teacher = "Mr. Davis",
            Notes = "Enthusiastic"
        });

        result.Grade.Should().Be("4th");
        result.Teacher.Should().Be("Mr. Davis");
        result.DisplayName.Should().Be("Olivia Grant");
        result.Notes.Should().Be("Enthusiastic");
    }

    [Fact]
    public async Task UpdateAsync_ChangesPersisted_ConfirmedViaGetById()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller { DisplayName = "Update Test", FirstName = "Up", LastName = "Date" };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        await service.UpdateAsync(seller.Id, new UpdateSellerRequest
        {
            DisplayName = "Updated Name",
            FirstName = "Up",
            LastName = "Dated"
        });

        var fetched = await service.GetByIdAsync(seller.Id);
        fetched!.DisplayName.Should().Be("Updated Name");
        fetched.LastName.Should().Be("Dated");
    }

    [Fact]
    public async Task UpdateAsync_WithNonExistentId_ThrowsKeyNotFoundException()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.UpdateAsync(Guid.NewGuid(), new UpdateSellerRequest { DisplayName = "X" }));
    }

    // ── EP-38: Delete seller (soft delete) ──

    [Fact]
    public async Task DeleteAsync_WithValidId_ReturnsTrue()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller { DisplayName = "Ethan Brooks", FirstName = "Ethan", LastName = "Brooks" };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        var result = await service.DeleteAsync(seller.Id);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WithNonExistentId_ReturnsFalse()
    {
        using var db = MockDbContextFactory.Create();
        var service = new SellerService(db);

        var result = await service.DeleteAsync(Guid.NewGuid());

        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteAsync_SetsDeletedAtTimestamp()
    {
        using var db = MockDbContextFactory.Create();
        var seller = new Seller { DisplayName = "To Delete" };
        db.Sellers.Add(seller);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        await service.DeleteAsync(seller.Id);

        var raw = await db.Sellers.IgnoreQueryFilters().FirstAsync(s => s.Id == seller.Id);
        raw.DeletedAt.Should().NotBeNull();
        raw.DeletedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task DeleteAsync_ExcludesFromDefaultQueries()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = MockDbContextFactory.Create(dbName);
        var sellerA = new Seller { DisplayName = "Ethan Brooks", FirstName = "Ethan", LastName = "Brooks" };
        var sellerB = new Seller { DisplayName = "Mia Lopez", FirstName = "Mia", LastName = "Lopez" };
        db.Sellers.AddRange(sellerA, sellerB);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        await service.DeleteAsync(sellerA.Id);

        using var db2 = MockDbContextFactory.Create(dbName);
        var service2 = new SellerService(db2);
        var listing = await service2.GetAllAsync(null, false, new PaginationParams { Page = 1, PageSize = 25 });
        listing.Items.Should().HaveCount(1);
        listing.Items[0].DisplayName.Should().Be("Mia Lopez");
    }

    [Fact]
    public async Task DeleteAsync_IncludedWhenIncludeDeletedIsTrue()
    {
        var dbName = Guid.NewGuid().ToString();
        using var db = MockDbContextFactory.Create(dbName);
        var sellerA = new Seller { DisplayName = "Ethan Brooks" };
        var sellerB = new Seller { DisplayName = "Mia Lopez" };
        db.Sellers.AddRange(sellerA, sellerB);
        await db.SaveChangesAsync();

        var service = new SellerService(db);
        await service.DeleteAsync(sellerA.Id);

        using var db2 = MockDbContextFactory.Create(dbName);
        var service2 = new SellerService(db2);
        var listing = await service2.GetAllAsync(null, true, new PaginationParams { Page = 1, PageSize = 25 });
        listing.Items.Should().HaveCount(2);
    }
}
