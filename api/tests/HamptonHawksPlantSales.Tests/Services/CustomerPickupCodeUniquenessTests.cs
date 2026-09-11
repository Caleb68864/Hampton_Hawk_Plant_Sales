using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// IX_Customers_PickupCode is unique and unfiltered, so a duplicate code on
/// update (or create) used to surface as a 23505 → 500. The service now
/// rejects it up front with a ValidationException.
/// </summary>
public class CustomerPickupCodeUniquenessTests
{
    [Fact]
    public async Task Update_DuplicatePickupCode_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        var a = new Customer { DisplayName = "A", PickupCode = "AAA111" };
        var b = new Customer { DisplayName = "B", PickupCode = "BBB222" };
        db.Customers.AddRange(a, b);
        await db.SaveChangesAsync();

        var act = () => new CustomerService(db).UpdateAsync(b.Id, new UpdateCustomerRequest
        {
            DisplayName = "B",
            PickupCode = "AAA111"
        });

        await act.Should().ThrowAsync<ValidationException>().WithMessage("*AAA111*already in use*");
        (await db.Customers.AsNoTracking().FirstAsync(c => c.Id == b.Id)).PickupCode.Should().Be("BBB222");
    }

    [Fact]
    public async Task Update_PickupCodeHeldBySoftDeletedCustomer_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        var gone = new Customer { DisplayName = "Gone", PickupCode = "OLD999", DeletedAt = DateTimeOffset.UtcNow };
        var b = new Customer { DisplayName = "B", PickupCode = "BBB222" };
        db.Customers.AddRange(gone, b);
        await db.SaveChangesAsync();

        var act = () => new CustomerService(db).UpdateAsync(b.Id, new UpdateCustomerRequest
        {
            DisplayName = "B",
            PickupCode = "OLD999"
        });

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Update_KeepingOwnPickupCode_IsAllowed()
    {
        using var db = MockDbContextFactory.Create();
        var b = new Customer { DisplayName = "B", PickupCode = "BBB222" };
        db.Customers.Add(b);
        await db.SaveChangesAsync();

        var result = await new CustomerService(db).UpdateAsync(b.Id, new UpdateCustomerRequest
        {
            DisplayName = "B renamed",
            PickupCode = "BBB222"
        });

        result.DisplayName.Should().Be("B renamed");
    }

    [Fact]
    public async Task Create_DuplicatePickupCode_IsRejected()
    {
        using var db = MockDbContextFactory.Create();
        db.Customers.Add(new Customer { DisplayName = "A", PickupCode = "AAA111" });
        await db.SaveChangesAsync();

        var act = () => new CustomerService(db).CreateAsync(new CreateCustomerRequest
        {
            DisplayName = "C",
            PickupCode = "AAA111"
        });

        await act.Should().ThrowAsync<ValidationException>();
    }
}
