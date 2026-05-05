using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public UserService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        var normalized = request.Username.Trim().ToUpperInvariant();

        var exists = await _db.AppUsers
            .AnyAsync(u => u.NormalizedUsername == normalized);

        if (exists)
            throw new InvalidOperationException($"Username '{request.Username}' is already taken.");

        var user = new AppUser
        {
            Username = request.Username.Trim(),
            NormalizedUsername = normalized,
            PasswordHash = _hasher.Hash(request.Password),
            IsActive = true,
            Roles = request.Roles.Select(r => new AppUserRole { Role = r }).ToList()
        };

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();

        return ToResponse(user);
    }

    public async Task<UserResponse?> GetByIdAsync(Guid id)
    {
        var user = await _db.AppUsers
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);

        return user is null ? null : ToResponse(user);
    }

    public async Task<UserResponse?> GetByUsernameAsync(string username)
    {
        var normalized = username.Trim().ToUpperInvariant();
        var user = await _db.AppUsers
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.NormalizedUsername == normalized);

        return user is null ? null : ToResponse(user);
    }

    public async Task<IEnumerable<UserResponse>> GetAllAsync()
    {
        var users = await _db.AppUsers
            .Include(u => u.Roles)
            .OrderBy(u => u.Username)
            .ToListAsync();

        return users.Select(ToResponse);
    }

    public async Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _db.AppUsers
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id)
            ?? throw new InvalidOperationException($"User {id} not found.");

        if (request.Password is not null)
            user.PasswordHash = _hasher.Hash(request.Password);

        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        if (request.Roles is not null)
        {
            _db.RemoveRange(user.Roles);
            user.Roles = request.Roles.Select(r => new AppUserRole { AppUserId = user.Id, Role = r }).ToList();
        }

        await _db.SaveChangesAsync();
        return ToResponse(user);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var user = await _db.AppUsers.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
            return false;

        user.DeletedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<UserResponse?> ValidateCredentialsAsync(string username, string password)
    {
        var normalized = username.Trim().ToUpperInvariant();
        var user = await _db.AppUsers
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.NormalizedUsername == normalized);

        if (user is null)
            return null;

        if (!user.IsActive)
            return null;

        if (!_hasher.Verify(password, user.PasswordHash))
            return null;

        return ToResponse(user);
    }

    private static UserResponse ToResponse(AppUser user) =>
        new(
            user.Id,
            user.Username,
            user.IsActive,
            user.Roles.Select(r => r.Role),
            user.CreatedAt,
            user.UpdatedAt
        );
}
