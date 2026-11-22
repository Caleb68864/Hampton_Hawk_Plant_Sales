namespace HamptonHawksPlantSales.Core.Models;

public class OrderLine : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid PlantCatalogId { get; set; }
    public int QtyOrdered { get; set; }
    public int QtyFulfilled { get; set; }
    public string? Notes { get; set; }
    public string? LastScanIdempotencyKey { get; set; }

    /// <summary>
    /// The plant's price when the line was created (or moved to its current plant),
    /// stamped by AppDbContext on save. Revenue uses it so a later price change does
    /// not rewrite past sales. Null on lines created before the column existed (and
    /// for unpriced plants): those fall back to the current catalog price.
    /// </summary>
    public decimal? UnitPrice { get; set; }

    public Order Order { get; set; } = null!;
    public PlantCatalog PlantCatalog { get; set; } = null!;
}
