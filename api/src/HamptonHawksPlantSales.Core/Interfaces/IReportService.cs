using HamptonHawksPlantSales.Core.DTOs;

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
}
