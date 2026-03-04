using FluentAssertions;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class OrderServiceTests
{
    private static OrderService CreateService(HamptonHawksPlantSales.Infrastructure.Data.AppDbContext db)
    {
        var protection = new Mock<IInventoryProtectionService>();
        var admin = new Mock<IAdminService>();
        admin.Setup(a => a.LogActionAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string?>()))
            .ReturnsAsync(new AdminAction { Id = Guid.NewGuid() });

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AdminPin"] = "1234" })
            .Build();

        return new OrderService(db, protection.Object, admin.Object, config);
    }

    [Fact]
    public async Task UpdateLine_WithQtyOnly_PreservesPlantAndUpdatesQty()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "SKU-OLD", barcode: "BC-OLD");
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 5 });

        Assert.Equal(5, response.QtyOrdered);
        Assert.Equal(plant.Id, response.PlantCatalogId);
    }

    [Fact]
    public async Task UpdateLine_WithQtyAndPlant_UpdatesBoth()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plantA = TestDataBuilder.CreatePlant(sku: "SKU-A", barcode: "BC-A");
        var plantB = TestDataBuilder.CreatePlant(sku: "SKU-B", barcode: "BC-B");
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plantA.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(plantA, plantB);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var response = await service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = 5, PlantCatalogId = plantB.Id });

        Assert.Equal(5, response.QtyOrdered);
        Assert.Equal(plantB.Id, response.PlantCatalogId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task UpdateLine_InvalidQty_ReturnsValidation(int qty)
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 2, qtyFulfilled: 0);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        await Assert.ThrowsAsync<ValidationException>(() =>
            service.UpdateLineAsync(order.Id, line.Id, new UpdateOrderLineRequest { QtyOrdered = qty }));
    }

    // ===== Helper to create a Seller entity =====
    private static Seller CreateSeller(string displayName = "Test Seller")
    {
        return new Seller
        {
            Id = Guid.NewGuid(),
            DisplayName = displayName,
            FirstName = "Test",
            LastName = "Seller",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    // ===== EP-16: List orders with filters and pagination =====

    [Fact]
    public async Task GetAllAsync_FilterByStatus_ReturnsOnlyMatchingOrders()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var orderOpen = TestDataBuilder.CreateOrder(customer.Id, status: OrderStatus.Open);
        var orderInProgress = TestDataBuilder.CreateOrder(customer.Id, status: OrderStatus.InProgress);
        var orderComplete = TestDataBuilder.CreateOrder(customer.Id, status: OrderStatus.Complete);

        db.Orders.AddRange(orderOpen, orderInProgress, orderComplete);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: OrderStatus.Open, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(orderOpen.Id);
    }

    [Fact]
    public async Task GetAllAsync_FilterByIsWalkUp_ReturnsOnlyWalkUpOrders()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var orderNonWalkUp = TestDataBuilder.CreateOrder(customer.Id, isWalkUp: false);
        var orderWalkUp = TestDataBuilder.CreateOrder(customer.Id, isWalkUp: true);

        db.Orders.AddRange(orderNonWalkUp, orderWalkUp);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: true, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(orderWalkUp.Id);
    }

    [Fact]
    public async Task GetAllAsync_FilterBySellerId_ReturnsOnlySellerOrders()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var seller = CreateSeller();
        db.Customers.Add(customer);
        db.Sellers.Add(seller);

        var orderWithSeller = TestDataBuilder.CreateOrder(customer.Id);
        orderWithSeller.SellerId = seller.Id;
        var orderNoSeller = TestDataBuilder.CreateOrder(customer.Id);

        db.Orders.AddRange(orderWithSeller, orderNoSeller);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: seller.Id, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(orderWithSeller.Id);
    }

    [Fact]
    public async Task GetAllAsync_FilterByCustomerId_ReturnsOnlyCustomerOrders()
    {
        using var db = MockDbContextFactory.Create();
        var customerA = TestDataBuilder.CreateCustomer("Customer A");
        var customerB = TestDataBuilder.CreateCustomer("Customer B");
        db.Customers.AddRange(customerA, customerB);

        var orderA = TestDataBuilder.CreateOrder(customerA.Id);
        var orderB = TestDataBuilder.CreateOrder(customerB.Id);

        db.Orders.AddRange(orderA, orderB);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: customerA.Id,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(orderA.Id);
    }

    [Fact]
    public async Task GetAllAsync_ExcludesDeletedByDefault()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var activeOrder = TestDataBuilder.CreateOrder(customer.Id);
        var deletedOrder = TestDataBuilder.CreateOrder(customer.Id);
        deletedOrder.DeletedAt = DateTimeOffset.UtcNow;

        db.Orders.AddRange(activeOrder, deletedOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(activeOrder.Id);
    }

    [Fact]
    public async Task GetAllAsync_IncludeDeleted_ReturnsDeletedOrders()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var activeOrder = TestDataBuilder.CreateOrder(customer.Id);
        var deletedOrder = TestDataBuilder.CreateOrder(customer.Id);
        deletedOrder.DeletedAt = DateTimeOffset.UtcNow;

        db.Orders.AddRange(activeOrder, deletedOrder);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: true, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(2);
        result.Items.Should().Contain(o => o.Id == deletedOrder.Id);
    }

    [Fact]
    public async Task GetAllAsync_Pagination_ReturnsCorrectPageAndTotalCount()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        for (int i = 0; i < 5; i++)
        {
            db.Orders.Add(TestDataBuilder.CreateOrder(customer.Id));
        }
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 2 });

        result.TotalCount.Should().Be(5);
        result.Items.Should().HaveCount(2);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(2);
    }

    [Fact]
    public async Task GetAllAsync_SearchByOrderNumber_ReturnsMatchingOrder()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var order1 = TestDataBuilder.CreateOrder(customer.Id);
        order1.OrderNumber = "ORD-UNIQUE-SEARCH";
        var order2 = TestDataBuilder.CreateOrder(customer.Id);
        order2.OrderNumber = "ORD-OTHER";

        db.Orders.AddRange(order1, order2);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: "UNIQUE-SEARCH", status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(order1.Id);
    }

    [Fact]
    public async Task GetAllAsync_SearchByCustomerName_ReturnsMatchingOrder()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer("Zara Plantlover");
        db.Customers.Add(customer);

        var otherCustomer = TestDataBuilder.CreateCustomer("John Doe");
        db.Customers.Add(otherCustomer);

        var order1 = TestDataBuilder.CreateOrder(customer.Id);
        var order2 = TestDataBuilder.CreateOrder(otherCustomer.Id);

        db.Orders.AddRange(order1, order2);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetAllAsync(
            search: "Zara", status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });

        result.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be(order1.Id);
    }

    // ===== EP-17: Get order by ID with lines and plant details =====

    [Fact]
    public async Task GetByIdAsync_ReturnsOrderWithLinesAndPlantDetails()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plantA = TestDataBuilder.CreatePlant(name: "EP17 Rose", sku: "EP17-ROSE", barcode: "BC-EP17A");
        var plantB = TestDataBuilder.CreatePlant(name: "EP17 Lily", sku: "EP17-LILY", barcode: "BC-EP17B");

        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plantA.Id, QtyOrdered = 3 },
                new() { PlantCatalogId = plantB.Id, QtyOrdered = 1 }
            }
        });

        var result = await service.GetByIdAsync(created.Id);

        result.Should().NotBeNull();
        result!.Id.Should().Be(created.Id);
        result.CustomerId.Should().Be(customer.Id);
        result.OrderNumber.Should().NotBeNullOrEmpty();
        result.Lines.Should().HaveCount(2);

        var lineA = result.Lines.First(l => l.PlantCatalogId == plantA.Id);
        lineA.PlantName.Should().Be("EP17 Rose");
        lineA.PlantSku.Should().Be("EP17-ROSE");
        lineA.QtyOrdered.Should().Be(3);
        lineA.QtyFulfilled.Should().Be(0);

        var lineB = result.Lines.First(l => l.PlantCatalogId == plantB.Id);
        lineB.PlantName.Should().Be("EP17 Lily");
        lineB.PlantSku.Should().Be("EP17-LILY");
        lineB.QtyOrdered.Should().Be(1);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistentId_ReturnsNull()
    {
        using var db = MockDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.GetByIdAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByIdAsync_SoftDeletedOrder_ReturnsNull()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);

        var order = TestDataBuilder.CreateOrder(customer.Id);
        order.DeletedAt = DateTimeOffset.UtcNow;
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.GetByIdAsync(order.Id);

        result.Should().BeNull();
    }

    // ===== EP-18: Create order with customer, seller, and line items =====

    [Fact]
    public async Task CreateAsync_WithLines_ReturnsOrderWithGeneratedNumberAndLines()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer("EP18 Customer");
        var seller = CreateSeller("EP18 Seller");
        var plant = TestDataBuilder.CreatePlant(name: "EP18 Basil", sku: "EP18-BASIL", barcode: "BC-EP18");

        db.Customers.Add(customer);
        db.Sellers.Add(seller);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            SellerId = seller.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 4 }
            }
        });

        result.Id.Should().NotBeEmpty();
        result.OrderNumber.Should().NotBeNullOrEmpty();
        result.CustomerId.Should().Be(customer.Id);
        result.SellerId.Should().Be(seller.Id);
        result.IsWalkUp.Should().BeFalse();
        result.Status.Should().Be(OrderStatus.Open);
        result.Lines.Should().HaveCount(1);
        result.Lines[0].PlantCatalogId.Should().Be(plant.Id);
        result.Lines[0].QtyOrdered.Should().Be(4);
        result.Lines[0].QtyFulfilled.Should().Be(0);
    }

    [Fact]
    public async Task CreateAsync_WithoutLines_ReturnsOrderWithEmptyLines()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = null
        });

        result.Id.Should().NotBeEmpty();
        result.OrderNumber.Should().NotBeNullOrEmpty();
        result.Lines.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAsync_GeneratesAutoOrderNumber_WhenNotProvided()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false
        });

        result.OrderNumber.Should().StartWith("ORD-");
    }

    [Fact]
    public async Task CreateAsync_UsesProvidedOrderNumber_WhenGiven()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var result = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            OrderNumber = "CUSTOM-ORD-001",
            IsWalkUp = false
        });

        result.OrderNumber.Should().Be("CUSTOM-ORD-001");
    }

    // ===== EP-19: Update order metadata =====

    [Fact]
    public async Task UpdateAsync_ChangesMetadataFields_AndPersists()
    {
        using var db = MockDbContextFactory.Create();
        var customerA = TestDataBuilder.CreateCustomer("Customer A");
        var customerB = TestDataBuilder.CreateCustomer("Customer B");
        var seller = CreateSeller();
        var plant = TestDataBuilder.CreatePlant(sku: "EP19-SKU", barcode: "BC-EP19");

        db.Customers.AddRange(customerA, customerB);
        db.Sellers.Add(seller);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customerA.Id,
            SellerId = seller.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 1 }
            }
        });

        created.Status.Should().Be(OrderStatus.Open);
        created.CustomerId.Should().Be(customerA.Id);

        var updated = await service.UpdateAsync(created.Id, new UpdateOrderRequest
        {
            CustomerId = customerB.Id,
            SellerId = seller.Id,
            Status = OrderStatus.InProgress,
            IsWalkUp = false,
            HasIssue = true
        });

        updated.CustomerId.Should().Be(customerB.Id);
        updated.Status.Should().Be(OrderStatus.InProgress);
        updated.HasIssue.Should().BeTrue();

        // Re-fetch to confirm persistence
        var refetched = await service.GetByIdAsync(created.Id);
        refetched.Should().NotBeNull();
        refetched!.CustomerId.Should().Be(customerB.Id);
        refetched.Status.Should().Be(OrderStatus.InProgress);
        refetched.HasIssue.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateAsync_NonExistentOrder_ThrowsKeyNotFoundException()
    {
        using var db = MockDbContextFactory.Create();
        var service = CreateService(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.UpdateAsync(Guid.NewGuid(), new UpdateOrderRequest
            {
                CustomerId = Guid.NewGuid(),
                Status = OrderStatus.Open,
                IsWalkUp = false,
                HasIssue = false
            }));
    }

    // ===== EP-20: Soft-delete an order =====

    [Fact]
    public async Task DeleteAsync_SoftDeletesOrder_ExcludedFromDefaultListing()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "EP20-SKU", barcode: "BC-EP20");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 1 }
            }
        });

        // Verify order appears in default listing before delete
        var beforeDelete = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });
        beforeDelete.Items.Should().Contain(o => o.Id == created.Id);

        // Delete the order
        var deleted = await service.DeleteAsync(created.Id);
        deleted.Should().BeTrue();

        // Verify excluded from default listing
        var afterDelete = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: false, new PaginationParams { Page = 1, PageSize = 25 });
        afterDelete.Items.Should().NotContain(o => o.Id == created.Id);

        // Verify included when includeDeleted=true
        var withDeleted = await service.GetAllAsync(
            search: null, status: null, isWalkUp: null, sellerId: null, customerId: null,
            includeDeleted: true, new PaginationParams { Page = 1, PageSize = 25 });
        withDeleted.Items.Should().Contain(o => o.Id == created.Id);
    }

    [Fact]
    public async Task DeleteAsync_SoftDeletedOrder_GetByIdReturnsNull()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "EP20B-SKU", barcode: "BC-EP20B");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 1 }
            }
        });

        await service.DeleteAsync(created.Id);

        var result = await service.GetByIdAsync(created.Id);
        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteAsync_NonExistentOrder_ReturnsFalse()
    {
        using var db = MockDbContextFactory.Create();
        var service = CreateService(db);

        var result = await service.DeleteAsync(Guid.NewGuid());
        result.Should().BeFalse();
    }

    // ===== EP-21: Add a line to an existing order =====

    [Fact]
    public async Task AddLineAsync_AddsLineToExistingOrder()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plantA = TestDataBuilder.CreatePlant(name: "EP21 Mint", sku: "EP21-MINT", barcode: "BC-EP21A");
        var plantB = TestDataBuilder.CreatePlant(name: "EP21 Sage", sku: "EP21-SAGE", barcode: "BC-EP21B");

        db.Customers.Add(customer);
        db.PlantCatalogs.AddRange(plantA, plantB);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plantA.Id, QtyOrdered = 2 }
            }
        });

        created.Lines.Should().HaveCount(1);

        var newLine = await service.AddLineAsync(created.Id, new CreateOrderLineRequest
        {
            PlantCatalogId = plantB.Id,
            QtyOrdered = 5,
            Notes = "EP-21 added line"
        });

        newLine.PlantCatalogId.Should().Be(plantB.Id);
        newLine.QtyOrdered.Should().Be(5);
        newLine.QtyFulfilled.Should().Be(0);
        newLine.Notes.Should().Be("EP-21 added line");

        // Re-fetch the order and verify both lines exist
        var refetched = await service.GetByIdAsync(created.Id);
        refetched.Should().NotBeNull();
        refetched!.Lines.Should().HaveCount(2);
        refetched.Lines.Should().Contain(l => l.PlantCatalogId == plantA.Id);
        refetched.Lines.Should().Contain(l => l.PlantCatalogId == plantB.Id);
    }

    [Fact]
    public async Task AddLineAsync_NonExistentOrder_ThrowsKeyNotFoundException()
    {
        using var db = MockDbContextFactory.Create();
        var plant = TestDataBuilder.CreatePlant(sku: "EP21-MISS", barcode: "BC-EP21M");
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.AddLineAsync(Guid.NewGuid(), new CreateOrderLineRequest
            {
                PlantCatalogId = plant.Id,
                QtyOrdered = 1
            }));
    }

    // ===== EP-23: Delete an order line (soft delete) =====

    [Fact]
    public async Task DeleteLineAsync_SoftDeletesLine_NoLongerAppearsInOrder()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(name: "EP23 Ivy", sku: "EP23-IVY", barcode: "BC-EP23");

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 2 },
                new() { PlantCatalogId = plant.Id, QtyOrdered = 1 }
            }
        });

        created.Lines.Should().HaveCount(2);
        var lineToDelete = created.Lines[0];
        var lineToKeep = created.Lines[1];

        var deleted = await service.DeleteLineAsync(created.Id, lineToDelete.Id);
        deleted.Should().BeTrue();

        // Re-fetch and verify only one line remains
        var refetched = await service.GetByIdAsync(created.Id);
        refetched.Should().NotBeNull();
        refetched!.Lines.Should().HaveCount(1);
        refetched.Lines[0].Id.Should().Be(lineToKeep.Id);
    }

    [Fact]
    public async Task DeleteLineAsync_NonExistentLine_ReturnsFalse()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "EP23-MISS", barcode: "BC-EP23M");
        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var created = await service.CreateAsync(new CreateOrderRequest
        {
            CustomerId = customer.Id,
            IsWalkUp = false,
            Lines = new List<CreateOrderLineRequest>
            {
                new() { PlantCatalogId = plant.Id, QtyOrdered = 1 }
            }
        });

        var result = await service.DeleteLineAsync(created.Id, Guid.NewGuid());
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteLineAsync_PartiallyFulfilledLine_ThrowsValidationException()
    {
        using var db = MockDbContextFactory.Create();
        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant(sku: "EP23-FUL", barcode: "BC-EP23F");

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);

        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: 5, qtyFulfilled: 2);

        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        var service = CreateService(db);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.DeleteLineAsync(order.Id, line.Id));
    }
}
