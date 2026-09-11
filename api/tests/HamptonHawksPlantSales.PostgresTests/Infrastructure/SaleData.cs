using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

/// <summary>A plant, its stock, and some pickup orders waiting for it.</summary>
public sealed record SaleSetup(Guid PlantId, string Barcode, IReadOnlyList<Guid> OrderIds);

public static class SaleData
{
    /// <summary>
    /// Seeds one plant with <paramref name="onHand"/> units and one open preorder per entry
    /// in <paramref name="qtyPerOrder"/>, each ordering that many of the plant.
    /// </summary>
    public static async Task<SaleSetup> PlantWithOrdersAsync(PgTestDb db, int onHand, params int[] qtyPerOrder)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var plant = new PlantCatalog
        {
            Sku = $"SKU-{suffix}",
            Name = $"Tomato {suffix}",
            Barcode = $"BC-{suffix}",
            IsActive = true
        };

        var orders = qtyPerOrder.Select((qty, i) => new Order
        {
            OrderNumber = $"PRE-{suffix}-{i + 1}",
            Status = OrderStatus.Open,
            OrderLines =
            {
                new OrderLine { PlantCatalog = plant, QtyOrdered = qty, QtyFulfilled = 0 }
            }
        }).ToList();

        await db.ExecuteAsync(async ctx =>
        {
            ctx.PlantCatalogs.Add(plant);
            ctx.Inventories.Add(new Inventory { PlantCatalog = plant, OnHandQty = onHand });
            ctx.Orders.AddRange(orders);
            await ctx.SaveChangesAsync();
        });

        return new SaleSetup(plant.Id, plant.Barcode, orders.Select(o => o.Id).ToList());
    }

    public static Task<int> OnHandAsync(PgTestDb db, Guid plantId) =>
        db.QueryAsync(ctx => ctx.Inventories.AsNoTracking()
            .Where(i => i.PlantCatalogId == plantId)
            .Select(i => i.OnHandQty)
            .SingleAsync());

    public static Task<int> TotalFulfilledAsync(PgTestDb db, Guid plantId) =>
        db.QueryAsync(ctx => ctx.OrderLines.AsNoTracking()
            .Where(l => l.PlantCatalogId == plantId)
            .SumAsync(l => l.QtyFulfilled));

    public static Task<List<FulfillmentEvent>> EventsAsync(PgTestDb db, Guid plantId) =>
        db.QueryAsync(ctx => ctx.FulfillmentEvents.AsNoTracking()
            .Where(e => e.PlantCatalogId == plantId)
            .ToListAsync());
}
