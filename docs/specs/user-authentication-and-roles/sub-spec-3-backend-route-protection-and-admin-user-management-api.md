---
type: phase-spec
sub_spec: 3
title: "Backend Route Protection and Admin User Management API"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: [2]
---

# Sub-Spec 3: Backend Route Protection and Admin User Management API

## Shared Context

This phase puts server-side authorization in front of existing APIs and adds admin-only user management. Existing admin PIN flows should continue to work unless explicitly changed. Print routes are frontend routes, but their API dependencies should be considered carefully so desktop printing is not broken unexpectedly.

## Codebase Analysis

- Controllers live under `api/src/HamptonHawksPlantSales.Api/Controllers/`.
- Admin actions currently use `[RequiresAdminPin]`.
- DTOs live in `Core/DTOs`; validators in `Core/Validators`.
- Controller tests live under `api/tests/HamptonHawksPlantSales.Tests/Services/`.

## Interfaces

### Provides

- Admin-only `/api/users` endpoints:
  - `GET /api/users`
  - `POST /api/users`
  - `PATCH /api/users/{id}/status` or equivalent disable/enable route
  - `POST /api/users/{id}/reset-password`
  - `PUT /api/users/{id}/roles`
- Authorization attributes/policies on existing API controllers.

### Requires

- Cookie auth and policies from Sub-Spec 2.
- User service from Sub-Spec 1.

### Shared State

Sub-Spec 5 consumes `/api/users`. Sub-Spec 4 consumes protected API behavior through frontend route/auth handling.

## Implementation Steps

### Step 1: Extend user service for admin management

**Test first**
- Extend `UserServiceTests` with:
  - `DisableUserAsync_RejectsLastActiveAdmin`
  - `ResetPasswordAsync_ReplacesPasswordHash`
  - `ReplaceRolesAsync_RejectsEmptyAdminSetIfTargetIsLastAdmin`

**Run to confirm failure**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"
```

**Implement**
- Add service methods for list, disable/enable, reset password, and replace roles.
- Add DTOs in `UserDtos.cs` or `AuthDtos.cs`.
- Add validators for create/reset/roles requests.
- Log user-management mutations through `IAdminService` or existing admin-action pattern where practical.

### Step 2: Add users controller

**Test first**
- Create `api/tests/HamptonHawksPlantSales.Tests/Services/UsersControllerTests.cs`.
- Tests:
  - `Create_ReturnsUserEnvelope`
  - `Disable_ReturnsUpdatedUser`
  - `ResetPassword_ReturnsOkEnvelope`
  - `ReplaceRoles_ReturnsUpdatedUser`

**Implement**
- Add `UsersController` at `[Route("api/users")]`.
- Decorate with `[Authorize(Policy = "RequireAdmin")]`.
- Keep controller thin and return `ApiResponse<T>`.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UsersControllerTests|FullyQualifiedName~UserServiceTests"
```

### Step 3: Protect existing API controllers

**Test first**
- Create `api/tests/HamptonHawksPlantSales.Tests/Auth/ControllerAuthorizationTests.cs`.
- Use reflection tests to verify relevant controllers/actions have `[Authorize]` or documented `[AllowAnonymous]`.

**Implement**
- Add `[Authorize]` and named policies to controllers/actions.
- Suggested mapping:
  - Admin-only: settings mutations, imports, admin actions, user management.
  - Pickup: fulfillment/pickup scan endpoints.
  - Lookup: lookup/print station data needs.
  - POS: walk-up register endpoints.
  - Reports: report endpoints.
  - General authenticated: basic dashboard/list/detail routes where appropriate.
- Do not protect health checks.
- Do not make print workflows unusable without documenting the decision.

**Verify**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UsersControllerTests|FullyQualifiedName~ControllerAuthorizationTests|FullyQualifiedName~UserServiceTests"
dotnet build HamptonHawksPlantSales.sln --no-restore
```

## Acceptance Checks

- `/api/users` is admin-only.
- Last active admin cannot be disabled.
- Protected endpoints return `401` unauthenticated and `403` wrong role in integration/manual checks.
- Existing admin PIN flows still compile and work.

## Suggested Commit

`feat(auth): protect api routes and add user management endpoints`

