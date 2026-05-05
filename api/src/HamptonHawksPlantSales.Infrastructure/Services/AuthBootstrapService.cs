using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class AuthBootstrapService : IHostedService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AuthBootstrapService> _logger;

    public AuthBootstrapService(IServiceScopeFactory scopeFactory, ILogger<AuthBootstrapService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var username = config["Bootstrap:AdminUsername"];
        var password = config["Bootstrap:AdminPassword"];

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogInformation("Bootstrap admin credentials not configured — skipping.");
            return;
        }

        var normalized = username.Trim().ToUpperInvariant();

        var existing = await db.AppUsers
            .IgnoreQueryFilters()
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.NormalizedUsername == normalized, cancellationToken);

        if (existing is null)
        {
            var user = new AppUser
            {
                Username = username.Trim(),
                NormalizedUsername = normalized,
                PasswordHash = hasher.Hash(password),
                IsActive = true,
                Roles = new List<AppUserRole> { new() { Role = AppRole.Admin } }
            };
            db.AppUsers.Add(user);
            await db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Bootstrap admin account '{Username}' created.", username);
        }
        else
        {
            // Restore soft-deleted admin and ensure they have the Admin role
            existing.DeletedAt = null;
            existing.IsActive = true;
            existing.PasswordHash = hasher.Hash(password);

            if (!existing.Roles.Any(r => r.Role == AppRole.Admin))
                existing.Roles.Add(new AppUserRole { AppUserId = existing.Id, Role = AppRole.Admin });

            await db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Bootstrap admin account '{Username}' updated.", username);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
