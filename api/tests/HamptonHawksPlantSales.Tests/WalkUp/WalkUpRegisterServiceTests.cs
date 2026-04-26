using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HamptonHawksPlantSales.Tests.WalkUp;

public class WalkUpRegisterServiceTests
{
    private static AppDbContext CreateDb() => MockDbContextFactory.Create();

    private static (WalkUpRegisterService Service,
                    Mock<IInventoryProtectionService> ProtectionMock,
                    Mock<IAdminService> AdminMock)
        CreateService(AppDbContext db, bool defaultAllowed = true)
    {
        var protectionMock = new Mock<IInventoryProtectionService>();
        protectionMock
            .Setup(p => p.ValidateWalkupLineAsync(It.IsAny<Guid>(), It.IsAny<int>(), It.IsAny<Guid?>()))
            .ReturnsAsync((Guid plantId, int qty, Guid? excludeId) =>
                defaultAllowed
                    ? (true, 999, (string?)null)
                    : (false, 0, (string?)"Walk-up availability exceeded."));

        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.LogActionAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var service = new WalkUpRegisterService(db, protectionMock.Object, adminMock.Object);
        return (service, protectionMock, adminMock);
    }

    [Fact]
    public async Task CreateDraft_ReturnsDraftStatusWalkUpNullCustomer()
    {
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);

        var result = await service.CreateDraftAsync(new CreateDraftRequest { WorkstationName = "Pickup-1" });

        result.Status.Should().Be(OrderStatus.Draft);
        result.IsWalkUp.Should().BeTrue();
        result.CustomerId.Should().BeNull();
        result.OrderNumber.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Scan_NewLine_DecrementsInventoryAndCreatesLine()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-WR-1", sku: "WR-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        var result = await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-WR-1", ScanId = "scan-1" });

        result.Lines.Should().HaveCount(1);
        result.Lines[0].QtyFulfilled.Should().Be(1);

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(4);
    }

    [Fact]
    public async Task Scan_IdempotencyKey_DeduplicatesScans()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-IDEM", sku: "IDEM-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        // First scan
        await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-IDEM", ScanId = "abc" });
        // Second scan with the same scanId should be a no-op
        var result = await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-IDEM", ScanId = "abc" });

        result.Lines.Should().HaveCount(1);
        result.Lines[0].QtyFulfilled.Should().Be(1);

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(4); // only one decrement
    }

    [Fact]
    public async Task Scan_DistinctScanIds_IncrementLine()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-MULT", sku: "MULT-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-MULT", ScanId = "s1" });
        var result = await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-MULT", ScanId = "s2" });

        result.Lines.Should().HaveCount(1);
        result.Lines[0].QtyFulfilled.Should().Be(2);
        result.Lines[0].QtyOrdered.Should().Be(2);

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(8);
    }

    [Fact]
    public async Task Scan_WalkUpLimitExceeded_ThrowsValidation()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-LIMIT", sku: "LIMIT-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 1);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, protectionMock, _) = CreateService(db);
        protectionMock
            .Setup(p => p.ValidateWalkupLineAsync(plant.Id, It.IsAny<int>(), It.IsAny<Guid?>()))
            .ReturnsAsync((false, 0, "Walk-up availability is 0."));

        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        var act = () => service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-LIMIT", ScanId = "s1" });
        await act.Should().ThrowAsync<ValidationException>();

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(1); // unchanged
    }

    [Fact]
    public async Task Scan_UnknownBarcode_ThrowsValidation()
    {
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        var act = () => service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "NOPE", ScanId = "s1" });
        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task VoidLine_RestoresInventory_SoftDeletesLine_LogsAdminAction()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-VOID", sku: "VOID-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, adminMock) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());
        await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-VOID", ScanId = "s1" });
        await service.ScanIntoDraftAsync(draft.Id,
            new ScanIntoDraftRequest { PlantBarcode = "BC-VOID", ScanId = "s2" });

        var line = await db.OrderLines.FirstAsync(l => l.OrderId == draft.Id);

        var result = await service.VoidLineAsync(draft.Id, line.Id, "Customer changed mind");

        result.Lines.Should().BeEmpty();

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(5); // restored

        var voidedLine = await db.OrderLines.IgnoreQueryFilters().FirstAsync(l => l.Id == line.Id);
        voidedLine.DeletedAt.Should().NotBeNull();

        adminMock.Verify(a => a.LogActionAsync(
            "WalkUpRegisterVoidLine",
            "OrderLine",
            line.Id,
            "Customer changed mind",
            It.IsAny<string?>()), Times.Once);
    }

    [Fact]
    public async Task CancelDraft_RestoresInventoryForAllLines_SoftDeletesDraft_LogsActions()
    {
        using var db = CreateDb();
        var plantA = TestDataBuilder.CreatePlant(barcode: "BC-CA-A", sku: "CA-A");
        var plantB = TestDataBuilder.CreatePlant(barcode: "BC-CA-B", sku: "CA-B");
        var invA = TestDataBuilder.CreateInventory(plantA.Id, onHandQty: 5);
        var invB = TestDataBuilder.CreateInventory(plantB.Id, onHandQty: 5);

        db.PlantCatalogs.AddRange(plantA, plantB);
        db.Inventories.AddRange(invA, invB);
        await db.SaveChangesAsync();

        var (service, _, adminMock) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-CA-A", ScanId = "s1" });
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-CA-A", ScanId = "s2" });
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-CA-B", ScanId = "s3" });

        var result = await service.CancelDraftAsync(draft.Id, "Customer left");

        var freshInvA = await db.Inventories.FindAsync(invA.Id);
        var freshInvB = await db.Inventories.FindAsync(invB.Id);
        freshInvA!.OnHandQty.Should().Be(5);
        freshInvB!.OnHandQty.Should().Be(5);

        var cancelled = await db.Orders.IgnoreQueryFilters().FirstAsync(o => o.Id == draft.Id);
        cancelled.DeletedAt.Should().NotBeNull();
        cancelled.Status.Should().Be(OrderStatus.Cancelled);

        adminMock.Verify(a => a.LogActionAsync(
            "WalkUpRegisterCancelDraft",
            "Order",
            draft.Id,
            "Customer left",
            It.IsAny<string?>()), Times.Once);

        // 2 distinct lines × 1 restore log each
        adminMock.Verify(a => a.LogActionAsync(
            "WalkUpRegisterCancelLineRestore",
            "OrderLine",
            It.IsAny<Guid>(),
            "Customer left",
            It.IsAny<string?>()), Times.Exactly(2));
    }

    [Fact]
    public async Task CloseDraft_WithLines_SetsCompleteAndPersistsPayment()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-CL", sku: "CL-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 5);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-CL", ScanId = "s1" });

        var result = await service.CloseDraftAsync(draft.Id, new CloseDraftRequest
        {
            PaymentMethod = "cash",
            AmountTendered = 20.00m
        });

        result.Status.Should().Be(OrderStatus.Complete);
        result.PaymentMethod.Should().Be("cash");
        result.AmountTendered.Should().Be(20.00m);
    }

    [Fact]
    public async Task CloseDraft_NoLines_ThrowsValidation()
    {
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());

        var act = () => service.CloseDraftAsync(draft.Id, new CloseDraftRequest());
        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task GetOpenDrafts_ReturnsOnlyDraftWalkUp()
    {
        using var db = CreateDb();
        var (service, _, _) = CreateService(db);
        var d1 = await service.CreateDraftAsync(new CreateDraftRequest());
        var d2 = await service.CreateDraftAsync(new CreateDraftRequest());

        // Add a non-draft, non-walkup order — should not appear
        var customer = TestDataBuilder.CreateCustomer();
        var preorder = TestDataBuilder.CreateOrder(customer.Id, OrderStatus.Open, isWalkUp: false);
        db.Customers.Add(customer);
        db.Orders.Add(preorder);
        await db.SaveChangesAsync();

        var open = await service.GetOpenDraftsAsync(null);
        open.Select(o => o.Id).Should().Contain(new[] { d1.Id, d2.Id });
        open.Should().OnlyContain(o => o.Status == OrderStatus.Draft && o.IsWalkUp);
    }

    [Fact]
    public async Task AdjustLine_ReduceQty_RestoresInventory()
    {
        using var db = CreateDb();
        var plant = TestDataBuilder.CreatePlant(barcode: "BC-ADJ", sku: "ADJ-1");
        var inv = TestDataBuilder.CreateInventory(plant.Id, onHandQty: 10);
        db.PlantCatalogs.Add(plant);
        db.Inventories.Add(inv);
        await db.SaveChangesAsync();

        var (service, _, _) = CreateService(db);
        var draft = await service.CreateDraftAsync(new CreateDraftRequest());
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-ADJ", ScanId = "s1" });
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-ADJ", ScanId = "s2" });
        await service.ScanIntoDraftAsync(draft.Id, new ScanIntoDraftRequest { PlantBarcode = "BC-ADJ", ScanId = "s3" });

        // Inventory should be 7 now
        var line = await db.OrderLines.FirstAsync(l => l.OrderId == draft.Id);

        await service.AdjustLineAsync(draft.Id, line.Id,
            new AdjustLineRequest { PlantCatalogId = plant.Id, NewQty = 1 });

        var freshInv = await db.Inventories.FindAsync(inv.Id);
        freshInv!.OnHandQty.Should().Be(9); // 7 + 2 restored
        var freshLine = await db.OrderLines.FindAsync(line.Id);
        freshLine!.QtyFulfilled.Should().Be(1);
    }
}
