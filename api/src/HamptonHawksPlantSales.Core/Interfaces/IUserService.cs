using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.Interfaces;

public interface IUserService
{
    Task<UserResponse> CreateAsync(CreateUserRequest request);
    Task<UserResponse?> GetByIdAsync(Guid id);
    Task<UserResponse?> GetByUsernameAsync(string username);
    Task<IEnumerable<UserResponse>> GetAllAsync();
    Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request);
    Task<UserResponse> DisableAsync(Guid id);
    Task<UserResponse> ResetPasswordAsync(Guid id, string newPassword);
    Task<UserResponse> AssignRolesAsync(Guid id, IEnumerable<AppRole> roles);
    Task<bool> DeleteAsync(Guid id);
    Task<UserResponse?> ValidateCredentialsAsync(string username, string password);
}
