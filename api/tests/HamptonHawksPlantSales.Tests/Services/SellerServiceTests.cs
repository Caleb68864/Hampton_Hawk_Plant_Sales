using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

namespace HamptonHawksPlantSales.Tests.Services;

public class SellerServiceTests
{
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
}
