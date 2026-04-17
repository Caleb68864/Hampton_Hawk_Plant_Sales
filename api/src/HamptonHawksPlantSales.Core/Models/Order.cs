using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Models;

public class Order : BaseEntity
{
    public Guid CustomerId { get; set; }
    public Guid? SellerId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Open;
    public bool IsWalkUp { get; set; }
    public bool HasIssue { get; set; }

    public Customer Customer { get; set; } = null!;
    public Seller? Seller { get; set; }
    public ICollection<OrderLine> OrderLines { get; set; } = new List<OrderLine>();
}
