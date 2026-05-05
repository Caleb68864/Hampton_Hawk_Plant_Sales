---
type: phase-spec
sub_spec: 1
title: "Backend User Model, Roles, and Bootstrap Admin"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: []
---

# Sub-Spec 1: Backend User Model, Roles, and Bootstrap Admin

## Shared Context

The API is ASP.NET Core 9 with EF Core 9 and PostgreSQL. Follow `CLAUDE.md`: thin controllers, service-layer logic in `Infrastructure/Services`, interfaces in `Core/Interfaces`, DTOs in `Core/DTOs`, validators in `Core/Validators`, and `ApiResponse<T>` for controller responses. Entities that need soft-delete behavior should extend `BaseEntity`; EF configurations live in `Infrastructure/Data/Configurations`.

This phase creates the data and service foundation for app-owned users. It does not wire browser login or route protection yet; those are Sub-Spec 2 and later.

## Codebase Analysis

- Existing entities such as `Order`, `Customer`, and `AdminAction` live in `api/src/HamptonHawksPlantSales.Core/Models/`.
- `AppDbContext` exposes `DbSet<T>` properties and applies configurations with `ApplyConfigurationsFromAssembly`.
- Service tests live under `api/tests/HamptonHawksPlantSales.Tests/Services/`.
- Existing services use EF directly and return DTOs or domain results; controllers stay thin.
- Existing admin PIN auth is not a user system and should remain untouched in this phase.

## Interfaces

### Provides

- `AppUser` persistence model.
- `AppRole` enum or equivalent constants with `Admin`, `Pickup`, `LookupPrint`, `POS`, `Reports`.
- `IUserService` methods needed by later phases:
  - `Task<AppUser?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)`
  - `Task<AppUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)`
  - `Task<AuthUserResponse?> ValidateCredentialsAsync(string username, string password, CancellationToken cancellationToken = default)`
  - `Task<UserResponse> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)`
  - `Task EnsureBootstrapAdminAsync(CancellationToken cancellationToken = default)`
- Password hashing/verification abstraction or framework-backed implementation.
- EF migration for users/roles.

### Requires

None.

### Shared State

Adds user tables and configuration consumed by all later auth phases.

## Implementation Steps

### Step 1: Define role and DTO contracts

**Test first**
- Create `api/tests/HamptonHawksPlantSales.Tests/Services/UserServiceTests.cs`.
- Add tests:
  - `CreateUserAsync_HashesPasswordAndReturnsRoles`
  - `CreateUserAsync_RejectsDuplicateNormalizedUsername`
  - `ValidateCredentialsAsync_ReturnsNullForDisabledUser`
  - `EnsureBootstrapAdminAsync_IsIdempotent`

**Run to confirm failure**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"
```

Expected: compile fails because user models/service do not exist.

**Implement**
- Add `api/src/HamptonHawksPlantSales.Core/Enums/AppRole.cs`.
- Add `api/src/HamptonHawksPlantSales.Core/DTOs/AuthDtos.cs` with request/response DTOs needed by this and later phases.
- Prefer a normalized username field (`NormalizedUsername`) to make uniqueness explicit.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"
```

Expected: still failing until service/model are implemented, but DTO/enum compile errors should be resolved.

### Step 2: Add persistence model and EF configuration

**Implement**
- Add `AppUser` and optional `AppUserRole` models.
- Extend `AppDbContext` with `DbSet<AppUser>` and optional `DbSet<AppUserRole>`.
- Add `AppUserConfiguration` with:
  - required `Username`
  - required `NormalizedUsername`
  - required `PasswordHash`
  - required active/disabled flag, preferably `IsActive`
  - role storage relationship/conversion
  - unique index on `NormalizedUsername` filtered for non-deleted rows if using `BaseEntity`

**Migration**

```powershell
Set-Location api
dotnet ef migrations add AddAppUsers --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```

**Verify migration shape**
- Confirm migration creates app user table(s), role data, unique normalized username index, and no plaintext password column.

### Step 3: Add password hashing and user service

**Implement**
- Add `IPasswordHasher` or use the framework hasher behind a local wrapper for simple tests.
- Add `UserService` in `Infrastructure/Services`.
- Register services in `Program.cs`.
- `CreateUserAsync` must normalize usernames, reject duplicates, hash passwords, validate role values, and return a safe DTO.
- `ValidateCredentialsAsync` must reject missing, disabled, or wrong-password users without exposing which condition occurred.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"
```

Expected: user service tests pass.

### Step 4: Add bootstrap admin

**Implement**
- Read bootstrap config from environment/configuration, for example:
  - `Auth__BootstrapAdmin__Username`
  - `Auth__BootstrapAdmin__Password`
- Implement idempotent bootstrap in a small service or in `UserService.EnsureBootstrapAdminAsync`.
- Call bootstrap during startup after migrations and before the app starts accepting requests.
- If username/password are missing and no active admin exists, log a clear warning or fail fast. Prefer fail fast for production safety if the app would otherwise be locked.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"
dotnet build HamptonHawksPlantSales.sln --no-restore
```

## Acceptance Checks

- `AppUser` has no plaintext password property.
- `AppRole` includes `Admin`, `Pickup`, `LookupPrint`, `POS`, `Reports`.
- Duplicate normalized usernames are rejected.
- Disabled users do not authenticate.
- Bootstrap admin can run twice without duplicates.

## Suggested Commit

`feat(auth): add app user model and bootstrap admin`

