using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.DTOs.Reports;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IReportService
{
    Task<DashboardMetricsResponse> GetDashboardMetricsAsync();
    Task<List<LowInventoryResponse>> GetLowInventoryAsync(int threshold = 5);
    Task<List<ProblemOrderResponse>> GetProblemOrdersAsync();
    Task<List<SellerOrderSummaryResponse>> GetSellerOrdersAsync(Guid sellerId);

    // SS-04/SS-05: Sales aggregate reports
    Task<List<SalesBySellerRow>> GetSalesBySellerAsync();
    Task<List<SalesByCustomerRow>> GetSalesByCustomerAsync();
    Task<List<SalesByPlantRow>> GetSalesByPlantAsync();

    // SS-02 (Wave 2): Operations / money / inventory aggregations
    Task<DailySalesResponse> GetDailySalesAsync(DateTime? from, DateTime? to);
    Task<PaymentBreakdownResponse> GetPaymentBreakdownAsync(DateTime? from, DateTime? to);
    Task<WalkupVsPreorderResponse> GetWalkupVsPreorderAsync(DateTime? from, DateTime? to);
    Task<StatusFunnelResponse> GetOrderStatusFunnelAsync();
    Task<TopMoversResponse> GetTopMoversAsync(int limit = 25);
    Task<OutstandingAgingResponse> GetOutstandingAgingAsync();

    // Sale-day live KPI dashboard (projector view).
    Task<LiveSaleKpiResponse> GetLiveSaleKpiAsync();
}
