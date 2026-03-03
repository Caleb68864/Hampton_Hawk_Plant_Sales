using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;

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
}
