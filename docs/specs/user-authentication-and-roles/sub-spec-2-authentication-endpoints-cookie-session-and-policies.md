---
type: phase-spec
sub_spec: 2
title: "Authentication Endpoints, Cookie Session, and Policies"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: [1]
---

# Sub-Spec 2: Authentication Endpoints, Cookie Session, and Policies

## Shared Context

This phase turns the user service from Sub-Spec 1 into browser authentication. The intended implementation is secure HTTP-only cookie auth. If cookie auth cannot work in the repo's Docker/LAN topology, stop and ask before switching to JWT.

## Codebase Analysis

- `Program.cs` currently has no `AddAuthentication`, `AddAuthorization`, `UseAuthentication`, or `UseAuthorization`.
- CORS currently allows configured origins, any header, and any method, but does not allow credentials.
- Controllers return `Ok(ApiResponse<T>.Ok(result))`.
- `AdminActionsController` shows current thin-controller style.

## Interfaces

### Provides

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- Authorization policies:
  - `RequireAdmin`
  - `RequirePickup`
  - `RequireLookup`
  - `RequirePos`
  - `RequireReports`

### Requires

- `IUserService.ValidateCredentialsAsync`
- safe auth DTOs and roles from Sub-Spec 1

### Shared State

Creates principal claims that Sub-Spec 3 policies and Sub-Spec 4 frontend auth state consume. Include user id, username, and roles as claims.

## Implementation Steps

### Step 1: Add auth controller tests

**Test first**
- Create `api/tests/HamptonHawksPlantSales.Tests/Services/AuthControllerTests.cs`.
- Tests:
  - `Login_WithValidCredentials_ReturnsUserEnvelope`
  - `Login_WithInvalidCredentials_ReturnsUnauthorized`
  - `Me_WhenUnauthenticated_ReturnsUnauthorized`
  - `Logout_ReturnsEnvelope`

**Run to confirm failure**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AuthControllerTests"
```

### Step 2: Implement `AuthController`

**Implement**
- Add `api/src/HamptonHawksPlantSales.Api/Controllers/AuthController.cs`.
- Inject `IUserService`.
- Use `HttpContext.SignInAsync` with a claims identity for login.
- Use `HttpContext.SignOutAsync` for logout.
- `Me` should read `HttpContext.User` and return `AuthUserResponse`.
- Keep response envelopes for successful responses.
- Return `Unauthorized(ApiResponse<object>.Fail(...))` or equivalent for failed login/current-user checks.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AuthControllerTests"
```

### Step 3: Wire cookie auth and policies

**Test first**
- Create `api/tests/HamptonHawksPlantSales.Tests/Auth/AuthPolicyTests.cs`.
- Tests can inspect authorization options or use a minimal policy provider to confirm role requirements exist.

**Implement**
- In `Program.cs`, register:
  - `AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(...)`
  - `AddAuthorization(...)` with named policies.
  - Cookie options appropriate to dev/prod.
- Add `UseAuthentication()` before `UseAuthorization()`, and both before `MapControllers()`.
- Update CORS to call `.AllowCredentials()` only when explicit origins are configured.
- Do not allow wildcard origins with credentials.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AuthControllerTests|FullyQualifiedName~AuthPolicyTests"
dotnet build HamptonHawksPlantSales.sln --no-restore
```

## Acceptance Checks

- Login sets an auth session and returns current user/roles.
- Logout clears session.
- `GET /api/auth/me` returns `401` when unauthenticated.
- Role policies exist and distinguish capabilities.
- CORS credentials are explicit-origin only.

## Suggested Commit

`feat(auth): add cookie login endpoints and role policies`

