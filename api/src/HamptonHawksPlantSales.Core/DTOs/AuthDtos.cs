using HamptonHawksPlantSales.Core.Enums;

namespace HamptonHawksPlantSales.Core.DTOs;

public record CreateUserRequest(
    string Username,
    string Password,
    IEnumerable<AppRole> Roles
);

public record UpdateUserRequest(
    string? Password,
    bool? IsActive,
    IEnumerable<AppRole>? Roles
);

public record LoginRequest(
    string Username,
    string Password
);

public record AuthUserResponse(
    Guid Id,
    string Username,
    bool IsActive,
    IEnumerable<string> Roles
);

public record UserResponse(
    Guid Id,
    string Username,
    bool IsActive,
    IEnumerable<AppRole> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record LoginResponse(
    string Token,
    UserResponse User
);
