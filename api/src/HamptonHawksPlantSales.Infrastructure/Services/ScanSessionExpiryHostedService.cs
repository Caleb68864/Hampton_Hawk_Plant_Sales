using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class ScanSessionExpiryHostedService : BackgroundService
{
    private static readonly TimeSpan DefaultInterval = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScanSessionExpiryHostedService> _logger;
    private readonly TimeSpan _interval;

    public ScanSessionExpiryHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<ScanSessionExpiryHostedService> logger,
        TimeSpan? interval = null)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _interval = interval ?? DefaultInterval;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "ScanSessionExpiryHostedService starting; interval={IntervalMinutes} min",
            _interval.TotalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IScanSessionService>();
                var closed = await service.ExpireStaleAsync(stoppingToken);

                if (closed > 0)
                    _logger.LogInformation("ScanSessionExpiryHostedService closed {Count} stale sessions", closed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Log and continue -- a single failed iteration must not kill the loop.
                _logger.LogError(ex, "ScanSessionExpiryHostedService iteration failed");
            }

            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
