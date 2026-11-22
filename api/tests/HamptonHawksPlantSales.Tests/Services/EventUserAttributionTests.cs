using FluentAssertions;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// Register scans, inventory adjustments, admin actions and import batches carried
/// no user; fulfillment events did. AppDbContext now stamps all of them.
/// </summary>
public class EventUserAttributionTests
{
    private sealed class FixedUser(Guid? id) : ICurrentUser
    {
        public Guid? UserId { get; } = id;
    }

    private static AppDbContext Context(ICurrentUser user)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options, user);
    }

    [Fact]
    public async Task NewEventRows_AreStampedWithTheSignedInAccount()
    {
        var userId = Guid.NewGuid();
        using var db = Context(new FixedUser(userId));
        var plant = TestDataBuilder.CreatePlant(sku: "ATTR", barcode: "BC-ATTR");
        db.PlantCatalogs.Add(plant);
        db.AdminActions.Add(new AdminAction { ActionType = "Test", EntityType = "Plant", EntityId = plant.Id, Reason = "r" });
        db.InventoryAdjustments.Add(new InventoryAdjustment { PlantCatalogId = plant.Id, DeltaQty = 1, Reason = "count" });
        db.ImportBatches.Add(new ImportBatch { Filename = "plants.csv" });
        await db.SaveChangesAsync();

        (await db.AdminActions.SingleAsync()).UserId.Should().Be(userId);
        (await db.InventoryAdjustments.SingleAsync()).UserId.Should().Be(userId);
        (await db.ImportBatches.SingleAsync()).UserId.Should().Be(userId);
    }

    [Fact]
    public async Task AnExplicitUser_IsKept_AndNoSignedInUserLeavesItNull()
    {
        var explicitId = Guid.NewGuid();
        using var db = Context(new FixedUser(null));
        db.AdminActions.Add(new AdminAction { ActionType = "A", EntityType = "X", Reason = "r", UserId = explicitId });
        db.AdminActions.Add(new AdminAction { ActionType = "B", EntityType = "X", Reason = "r" });
        await db.SaveChangesAsync();

        (await db.AdminActions.SingleAsync(a => a.ActionType == "A")).UserId.Should().Be(explicitId);
        (await db.AdminActions.SingleAsync(a => a.ActionType == "B")).UserId.Should().BeNull();
    }

    [Fact]
    public void TheApiBuildsTheContextWithTheCurrentUser()
    {
        // Two constructors: DI must pick the one that takes ICurrentUser, or the
        // stamping silently never runs.
        using var factory = new TestApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var field = typeof(AppDbContext).GetField("_currentUser", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        field.GetValue(db).Should().NotBeNull();
    }

    [Fact]
    public async Task OrderEvents_NameTheAccountThatWroteThem()
    {
        using var db = MockDbContextFactory.Create();
        var user = new AppUser { Username = "pickup-2", NormalizedUsername = "PICKUP-2" };
        var customer = TestDataBuilder.CreateCustomer("Named");
        db.AppUsers.Add(user);
        db.Customers.Add(customer);
        var order = TestDataBuilder.CreateOrder(customer.Id, HamptonHawksPlantSales.Core.Enums.OrderStatus.Open);
        db.Orders.Add(order);
        db.FulfillmentEvents.Add(new FulfillmentEvent { OrderId = order.Id, Barcode = "1", Result = HamptonHawksPlantSales.Core.Enums.FulfillmentResult.Accepted, UserId = user.Id });
        db.FulfillmentEvents.Add(new FulfillmentEvent { OrderId = order.Id, Barcode = "2", Result = HamptonHawksPlantSales.Core.Enums.FulfillmentResult.Accepted });
        await db.SaveChangesAsync();
        var admin = new Moq.Mock<IAdminService>();

        var events = await new HamptonHawksPlantSales.Infrastructure.Services.FulfillmentService(db, admin.Object).GetEventsAsync(order.Id);

        events.Single(e => e.Barcode == "1").UserName.Should().Be("pickup-2");
        events.Single(e => e.Barcode == "2").UserName.Should().BeNull();
    }
}
