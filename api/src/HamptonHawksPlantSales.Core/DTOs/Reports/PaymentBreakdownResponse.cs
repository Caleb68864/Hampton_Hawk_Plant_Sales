namespace HamptonHawksPlantSales.Core.DTOs.Reports;

// SS-02 (Wave 2): Payment method breakdown. Groups orders by PaymentMethod
// (null/empty -> "Unspecified") and reports per-method order count, revenue,
// and average order value. Excludes soft-deleted and Draft orders.

public class PaymentBreakdownResponse
{
    public List<PaymentBreakdownRowDto> Methods { get; set; } = new();
}

public class PaymentBreakdownRowDto
{
    public string Method { get; set; } = string.Empty;
    public int OrderCount { get; set; }
    public decimal Revenue { get; set; }
    public decimal AverageOrder { get; set; }
}
