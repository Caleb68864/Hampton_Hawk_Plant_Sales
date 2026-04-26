using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IScanSessionService
{
    Task<ScanSessionResponse> CreateFromPicklistAsync(string scannedBarcode, string workstationName);
    Task<ScanSessionResponse> GetAsync(Guid sessionId);
    Task<ScanSessionScanResponse> ScanInSessionAsync(Guid sessionId, string plantBarcode);
    Task<ScanSessionResponse> ExpandAsync(Guid sessionId, IReadOnlyCollection<Guid> additionalOrderIds);
    Task<ScanSessionResponse> CloseAsync(Guid sessionId);
    Task<int> ExpireStaleAsync(CancellationToken cancellationToken = default);
}
