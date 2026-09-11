using FluentAssertions;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// The bug this branch exists to fix, tested against a provider that can see it.
///
/// <c>PicklistBarcode</c> is <c>IsRequired()</c> with a unique index filtered on
/// <c>DeletedAt IS NULL</c>, defaults to <c>string.Empty</c>, and before this
/// branch no code assigned one. The second customer or seller ever inserted
/// collided on <c>''</c> and came back as a 500. <see cref="AppDbContext"/> now
/// assigns one in <c>SaveChangesAsync</c>.
///
/// <see cref="PicklistBarcodeGenerationTests"/> pins the generator's output, but
/// it runs on the InMemory provider, which enforces no unique index -- so it
/// cannot distinguish the fix from its absence. These run on SQLite, which does.
/// </summary>
public class PicklistBarcodeConstraintTests
{
    [Fact]
    public async Task TheProviderEnforcesTheUniqueIndex()
    {
        // Control, and the reason the rest of this file means anything. If this
        // ever stops throwing, every other test here has quietly become a test
        // that cannot fail -- which is exactly what happened under InMemory.
        using var harness = new ConstraintEnforcingDbContext();

        harness.Db.Customers.Add(new Customer
        {
            DisplayName = "Jane Doe",
            PickupCode = "A1",
            PicklistBarcode = "PLB-cafebabe"
        });
        harness.Db.Customers.Add(new Customer
        {
            DisplayName = "John Smith",
            PickupCode = "A2",
            PicklistBarcode = "PLB-cafebabe"
        });

        var act = async () => await harness.Db.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task TwoCustomersCreatedWithoutBarcodes_BothInsert()
    {
        // The production failure, verbatim: two customers, neither carrying a
        // barcode. Before AppDbContext assigned one, both went in as '' and the
        // second raised 23505.
        using var harness = new ConstraintEnforcingDbContext();

        harness.Db.Customers.Add(new Customer { DisplayName = "Jane Doe", PickupCode = "A1" });
        harness.Db.Customers.Add(new Customer { DisplayName = "John Smith", PickupCode = "A2" });

        await harness.Db.SaveChangesAsync();

        var codes = await harness.Db.Customers.Select(c => c.PicklistBarcode).ToListAsync();
        codes.Should().HaveCount(2);
        codes.Should().OnlyHaveUniqueItems();
        codes.Should().AllSatisfy(c => c.Should().MatchRegex("^PLB-[0-9a-f]{8}$"));
    }

    [Fact]
    public async Task TwoSellersCreatedWithoutBarcodes_BothInsert()
    {
        using var harness = new ConstraintEnforcingDbContext();

        harness.Db.Sellers.Add(new Seller { DisplayName = "Alice Johnson" });
        harness.Db.Sellers.Add(new Seller { DisplayName = "Bob Martinez" });

        await harness.Db.SaveChangesAsync();

        var codes = await harness.Db.Sellers.Select(s => s.PicklistBarcode).ToListAsync();
        codes.Should().HaveCount(2);
        codes.Should().OnlyHaveUniqueItems();
        codes.Should().AllSatisfy(c => c.Should().MatchRegex("^PLS-[0-9a-f]{8}$"));
    }

    [Fact]
    public async Task CustomersAddedAcrossSeparateSaves_AlsoGetDistinctBarcodes()
    {
        // The shape the 500 actually took in production: not two rows in one
        // SaveChanges, but a second customer created minutes after the first.
        using var harness = new ConstraintEnforcingDbContext();

        harness.Db.Customers.Add(new Customer { DisplayName = "Jane Doe", PickupCode = "A1" });
        await harness.Db.SaveChangesAsync();

        harness.Db.Customers.Add(new Customer { DisplayName = "John Smith", PickupCode = "A2" });
        await harness.Db.SaveChangesAsync();

        var codes = await harness.Db.Customers.Select(c => c.PicklistBarcode).ToListAsync();
        codes.Should().HaveCount(2).And.OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task SoftDeletingACustomerReleasesItsBarcode()
    {
        // The index is filtered on DeletedAt IS NULL, so a soft-deleted row must
        // not keep a barcode reserved. Under InMemory this assertion would hold
        // whether the filter existed or not.
        using var harness = new ConstraintEnforcingDbContext();

        var first = new Customer
        {
            DisplayName = "Jane Doe",
            PickupCode = "A1",
            PicklistBarcode = "PLB-0f0f0f0f"
        };
        harness.Db.Customers.Add(first);
        await harness.Db.SaveChangesAsync();

        first.DeletedAt = DateTimeOffset.UtcNow;
        await harness.Db.SaveChangesAsync();

        harness.Db.Customers.Add(new Customer
        {
            DisplayName = "John Smith",
            PickupCode = "A2",
            PicklistBarcode = "PLB-0f0f0f0f"
        });

        var act = async () => await harness.Db.SaveChangesAsync();

        await act.Should().NotThrowAsync();
    }
}
