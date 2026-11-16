using System.Security.Claims;
using FluentAssertions;
using HamptonHawksPlantSales.Api.Configuration;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// Every fulfillment event records the signed-in account and the write path, so the
/// post-sale audit can answer "which station did this" from the row alone instead of
/// cross-referencing the paper volunteer sheet.
/// </summary>
public class FulfillmentEventAttributionTests
{
    private static readonly Guid StationUserId = Guid.NewGuid();

    private sealed class FixedUser : ICurrentUser
    {
        public Guid? UserId => StationUserId;
    }

    private static FulfillmentService Fulfillment(AppDbContext db)
    {
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        admin.Setup(a => a.LogActionAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });
        return new FulfillmentService(db, admin.Object, new FixedUser());
    }

    private static (PlantCatalog Plant, Order Order, OrderLine Line) Seed(AppDbContext db)
    {
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-ATTR", sku: "SKU-ATTR");
        var customer = TestDataBuilder.CreateCustomer();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 3);
        db.AddRange(plant, customer, order, line, TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10));
        db.SaveChanges();
        return (plant, order, line);
    }

    private static Task<List<FulfillmentEvent>> EventsAsync(AppDbContext db) =>
        db.FulfillmentEvents.IgnoreQueryFilters().AsNoTracking().ToListAsync();

    [Fact]
    public async Task Pickup_scans_record_the_user_and_source_on_accepted_and_rejected_events()
    {
        using var db = MockDbContextFactory.Create();
        var (_, order, _) = Seed(db);
        var service = Fulfillment(db);

        (await service.ScanAsync(order.Id, "BC-ATTR")).Result.Should().Be(FulfillmentResult.Accepted);
        (await service.ScanAsync(order.Id, "NO-SUCH-PLANT")).Result.Should().Be(FulfillmentResult.NotFound);

        var events = await EventsAsync(db);
        events.Should().HaveCount(2);
        events.Should().OnlyContain(e => e.UserId == StationUserId && e.Source == FulfillmentEventSource.PickupScan);
    }

    [Fact]
    public async Task Manual_fulfil_and_undo_record_their_own_source()
    {
        using var db = MockDbContextFactory.Create();
        var (_, order, line) = Seed(db);
        var service = Fulfillment(db);

        await service.ManualFulfillAsync(order.Id,
            new ManualFulfillRequest { OrderLineId = line.Id, Reason = "torn label", OperatorName = "desk" });
        await service.UndoLastScanAsync(order.Id, "wrong plant", "desk");

        var events = await EventsAsync(db);
        events.Should().OnlyContain(e => e.UserId == StationUserId);
        events.Single(e => e.Result == FulfillmentResult.Accepted).Source.Should().Be(FulfillmentEventSource.ManualFulfill);
        events.Single(e => e.Result == FulfillmentResult.Undone).Source.Should().Be(FulfillmentEventSource.Undo);
    }

    [Fact]
    public async Task Session_scans_record_the_user_and_source()
    {
        using var db = MockDbContextFactory.Create();
        var (_, order, _) = Seed(db);
        var session = new ScanSession
        {
            EntityKind = ScanSessionEntityKind.AdHoc,
            WorkstationName = "Pickup 1",
            ExpiresAt = DateTimeOffset.UtcNow.AddHours(1)
        };
        session.Members.Add(new ScanSessionMember { OrderId = order.Id });
        db.ScanSessions.Add(session);
        await db.SaveChangesAsync();

        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);
        var service = new ScanSessionService(db, admin.Object, new ConfigurationBuilder().Build(), new FixedUser());

        (await service.ScanInSessionAsync(session.Id, "BC-ATTR")).Result.Should().Be(ScanSessionResult.Accepted);

        (await EventsAsync(db)).Should().ContainSingle()
            .Which.Should().Match<FulfillmentEvent>(e => e.UserId == StationUserId && e.Source == FulfillmentEventSource.SessionScan);
    }

    /// <summary>
    /// The current-user parameter is optional so unit tests need not pass it; make sure the
    /// container really injects it rather than silently taking the null default.
    /// </summary>
    [Fact]
    public async Task The_container_injects_the_current_user_into_the_service()
    {
        using var db = MockDbContextFactory.Create();
        var (_, order, _) = Seed(db);
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.IsSaleClosedAsync()).ReturnsAsync(false);

        var services = new ServiceCollection();
        services.AddSingleton(db);
        services.AddSingleton(admin.Object);
        services.AddScoped<ICurrentUser, FixedUser>();
        services.AddScoped<IFulfillmentService, FulfillmentService>();
        using var provider = services.BuildServiceProvider();

        await provider.GetRequiredService<IFulfillmentService>().ScanAsync(order.Id, "BC-ATTR");

        (await EventsAsync(db)).Should().ContainSingle().Which.UserId.Should().Be(StationUserId);
    }

    [Fact]
    public void The_http_current_user_is_the_signed_in_accounts_id_and_null_when_anonymous()
    {
        var accessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, StationUserId.ToString()) }, "cookie"))
            }
        };
        new HttpCurrentUser(accessor).UserId.Should().Be(StationUserId);

        new HttpCurrentUser(new HttpContextAccessor { HttpContext = new DefaultHttpContext() }).UserId.Should().BeNull();
        new HttpCurrentUser(new HttpContextAccessor()).UserId.Should().BeNull();
    }
}
