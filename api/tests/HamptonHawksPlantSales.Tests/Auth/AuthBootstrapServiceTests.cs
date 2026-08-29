using FluentAssertions;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace HamptonHawksPlantSales.Tests.Auth;

/// <summary>
/// The bootstrap password seeds the first admin account. It must never be
/// re-applied on a later startup, or an admin's rotated password is silently
/// reverted every time the container restarts.
/// </summary>
public class AuthBootstrapServiceTests
{
    private static (AuthBootstrapService Service, string DbName) Build(string username, string password)
    {
        var dbName = Guid.NewGuid().ToString();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Bootstrap:AdminUsername"] = username,
                ["Bootstrap:AdminPassword"] = password
            })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(config);
        services.AddScoped<AppDbContext>(_ => MockDbContextFactory.Create(dbName));
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        var provider = services.BuildServiceProvider();

        return (new AuthBootstrapService(provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<AuthBootstrapService>.Instance), dbName);
    }

    [Fact]
    public async Task FirstStart_CreatesAdminWithBootstrapPassword()
    {
        var (service, dbName) = Build("admin", "bootstrap-pass");

        await service.StartAsync(CancellationToken.None);

        using var db = MockDbContextFactory.Create(dbName);
        var user = await db.AppUsers.Include(u => u.Roles).SingleAsync();
        user.Username.Should().Be("admin");
        user.IsActive.Should().BeTrue();
        user.Roles.Should().Contain(r => r.Role == AppRole.Admin);
        new PasswordHasher().Verify("bootstrap-pass", user.PasswordHash).Should().BeTrue();
    }

    [Fact]
    public async Task Restart_DoesNotRevertARotatedPassword()
    {
        var (service, dbName) = Build("admin", "bootstrap-pass");
        await service.StartAsync(CancellationToken.None);

        // Admin rotates the password through the app.
        using (var db = MockDbContextFactory.Create(dbName))
        {
            var user = await db.AppUsers.SingleAsync();
            user.PasswordHash = new PasswordHasher().Hash("rotated-pass");
            await db.SaveChangesAsync();
        }

        // Container restarts with the same bootstrap configuration.
        await service.StartAsync(CancellationToken.None);

        using var verify = MockDbContextFactory.Create(dbName);
        var after = await verify.AppUsers.SingleAsync();
        new PasswordHasher().Verify("rotated-pass", after.PasswordHash).Should().BeTrue();
        new PasswordHasher().Verify("bootstrap-pass", after.PasswordHash).Should().BeFalse();
    }

    [Fact]
    public async Task Restart_RestoresDeletedInactiveAdminWithoutTouchingPassword()
    {
        var (service, dbName) = Build("admin", "bootstrap-pass");
        var rotatedHash = new PasswordHasher().Hash("rotated-pass");

        using (var db = MockDbContextFactory.Create(dbName))
        {
            db.AppUsers.Add(new AppUser
            {
                Username = "admin",
                NormalizedUsername = "ADMIN",
                PasswordHash = rotatedHash,
                IsActive = false,
                DeletedAt = DateTimeOffset.UtcNow,
                Roles = new List<AppUserRole> { new() { Role = AppRole.Reports } }
            });
            await db.SaveChangesAsync();
        }

        await service.StartAsync(CancellationToken.None);

        using var verify = MockDbContextFactory.Create(dbName);
        var after = await verify.AppUsers.IgnoreQueryFilters().Include(u => u.Roles).SingleAsync();
        after.DeletedAt.Should().BeNull();
        after.IsActive.Should().BeTrue();
        after.Roles.Should().Contain(r => r.Role == AppRole.Admin);
        after.PasswordHash.Should().Be(rotatedHash);
    }
}
