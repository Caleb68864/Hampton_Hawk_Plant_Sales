using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// PicklistBarcode carries a unique index (filtered on DeletedAt IS NULL) in
/// Postgres. The in-memory provider does not enforce it, which is how every
/// creation path shipped without assigning one: the first customer got "" and
/// the second failed with 23505 in production. These tests pin the generator.
/// </summary>
public class PicklistBarcodeGenerationTests
{
    [Fact]
    public async Task SaveChanges_AssignsDistinctPicklistBarcodes_ToNewCustomersAndSellers()
    {
        using var db = MockDbContextFactory.Create();
        db.Customers.Add(new Customer { DisplayName = "Jane Doe", PickupCode = "A1" });
        db.Customers.Add(new Customer { DisplayName = "John Smith", PickupCode = "A2" });
        db.Sellers.Add(new Seller { DisplayName = "Alice Johnson" });
        db.Sellers.Add(new Seller { DisplayName = "Bob Martinez" });

        await db.SaveChangesAsync();

        var customerCodes = await db.Customers.Select(c => c.PicklistBarcode).ToListAsync();
        var sellerCodes = await db.Sellers.Select(s => s.PicklistBarcode).ToListAsync();

        Assert.All(customerCodes, c => Assert.Matches("^PLB-[0-9a-f]{8}$", c));
        Assert.All(sellerCodes, c => Assert.Matches("^PLS-[0-9a-f]{8}$", c));
        Assert.Equal(2, customerCodes.Distinct().Count());
        Assert.Equal(2, sellerCodes.Distinct().Count());
    }

    [Fact]
    public async Task SaveChanges_KeepsAnExplicitPicklistBarcode()
    {
        using var db = MockDbContextFactory.Create();
        db.Customers.Add(new Customer { DisplayName = "Jane Doe", PickupCode = "A1", PicklistBarcode = "PLB-fixed001" });

        await db.SaveChangesAsync();

        Assert.Equal("PLB-fixed001", (await db.Customers.SingleAsync()).PicklistBarcode);
    }

    [Fact]
    public void NewPicklistBarcode_UsesPrefixAndEightHexChars()
    {
        Assert.Matches("^PLB-[0-9a-f]{8}$", AppDbContext.NewPicklistBarcode("PLB-"));
    }
}
