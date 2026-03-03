using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IReportService
{
    Task<DashboardMetricsResponse> GetDashboardMetricsAsync();
    Task<List<LowInventoryResponse>> GetLowInventoryAsync(int threshold = 5);
    Task<List<ProblemOrderResponse>> GetProblemOrdersAsync();
    Task<List<SellerOrderSummaryResponse>> GetSellerOrdersAsync(Guid sellerId);
}
