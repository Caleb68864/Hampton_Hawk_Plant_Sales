using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HamptonHawksPlantSales.Tests.Services;

public class UserServiceTests : IAsyncLifetime
{
    private AppDbContext _db = null!;
    private IUserService _sut = null!;
    private IPasswordHasher _hasher = null!;

    public async Task InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new AppDbContext(options);
        await _db.Database.EnsureCreatedAsync();

        _hasher = new PasswordHasher();
        _sut = new UserService(_db, _hasher);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task CreateAsync_HashesPassword_AndDoesNotStoreRaw()
    {
        var request = new CreateUserRequest("alice", "secret123", [AppRole.Admin]);

        var result = await _sut.CreateAsync(request);

        var stored = await _db.AppUsers.FirstAsync(u => u.Id == result.Id);
        Assert.NotEqual("secret123", stored.PasswordHash);
        Assert.False(string.IsNullOrWhiteSpace(stored.PasswordHash));
    }

    [Fact]
    public async Task CreateAsync_DuplicateUsername_Throws()
    {
        await _sut.CreateAsync(new CreateUserRequest("bob", "pass1", [AppRole.POS]));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => _sut.CreateAsync(new CreateUserRequest("BOB", "pass2", [AppRole.POS])));
    }

    [Fact]
    public async Task ValidateCredentialsAsync_CorrectPassword_ReturnsUser()
    {
        await _sut.CreateAsync(new CreateUserRequest("carol", "mypassword", [AppRole.Reports]));

        var result = await _sut.ValidateCredentialsAsync("carol", "mypassword");

        Assert.NotNull(result);
        Assert.Equal("carol", result.Username);
    }

    [Fact]
    public async Task ValidateCredentialsAsync_WrongPassword_ReturnsNull()
    {
        await _sut.CreateAsync(new CreateUserRequest("dave", "correcthorsebattery", [AppRole.Pickup]));

        var result = await _sut.ValidateCredentialsAsync("dave", "wrongpassword");

        Assert.Null(result);
    }

    [Fact]
    public async Task ValidateCredentialsAsync_DisabledUser_ReturnsNull()
    {
        var created = await _sut.CreateAsync(new CreateUserRequest("eve", "pass", [AppRole.LookupPrint]));
        await _sut.UpdateAsync(created.Id, new UpdateUserRequest(null, false, null));

        var result = await _sut.ValidateCredentialsAsync("eve", "pass");

        Assert.Null(result);
    }

    [Fact]
    public async Task CreateAsync_SetsRolesCorrectly()
    {
        var request = new CreateUserRequest("frank", "pw", [AppRole.Admin, AppRole.Reports]);

        var result = await _sut.CreateAsync(request);

        Assert.Contains(AppRole.Admin, result.Roles);
        Assert.Contains(AppRole.Reports, result.Roles);
    }

    [Fact]
    public async Task DeleteAsync_SoftDeletes_UserNotReturnedAfterwards()
    {
        var created = await _sut.CreateAsync(new CreateUserRequest("grace", "pw", [AppRole.POS]));

        var deleted = await _sut.DeleteAsync(created.Id);

        Assert.True(deleted);
        var fetched = await _sut.GetByIdAsync(created.Id);
        Assert.Null(fetched);
    }

    [Fact]
    public async Task PasswordHasher_VerifyReturnsFalse_ForWrongPassword()
    {
        var hash = _hasher.Hash("correctPassword");

        Assert.False(_hasher.Verify("wrongPassword", hash));
    }

    [Fact]
    public async Task PasswordHasher_VerifyReturnsTrue_ForCorrectPassword()
    {
        var hash = _hasher.Hash("mySecret");

        Assert.True(_hasher.Verify("mySecret", hash));
    }
}
