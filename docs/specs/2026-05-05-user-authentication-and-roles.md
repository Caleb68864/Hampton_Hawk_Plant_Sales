# Hampton Hawks Plant Sales -- User Authentication and Roles

## Meta

| Field | Value |
|-------|-------|
| Client | Personal / School Fundraiser |
| Project | Hampton Hawks Plant Sales |
| Repo | Hampton_Hawk_Plant_Sales |
| Date | 2026-05-05 |
| Author | Caleb Bennett |
| Source Design | `docs/plans/2026-05-05-01-user-authentication-and-roles-design.md` |
| Quality | 29/30 |
| Outcome Clarity | 5 |
| Scope Boundaries | 5 |
| Decision Guidance | 5 |
| Edge Coverage | 5 |
| Acceptance Criteria | 5 |
| Decomposition | 4 |

## Outcome

Add first-party user authentication and role-based access control across the Hampton Hawks Plant Sales desktop and mobile app. Done means every normal app route requires a logged-in app user, admins can create and manage station/mobile accounts such as `POS2`, `POS3`, `Pickup1`, and temporary mobile users, and backend endpoints enforce roles so unauthorized users cannot scan, fulfill, manage settings, or view restricted data by calling APIs directly.

## Intent

### Trade-off Hierarchy

1. Prevent unauthorized sale-day scanning and admin access over preserving anonymous convenience.
2. Preserve existing desktop and kiosk workflows after login over redesigning working pages.
3. Prefer app-owned user accounts and station identities over public self-signup or per-volunteer identity complexity.
4. Prefer backend-enforced policies over frontend-only hiding of actions.
5. Prefer secure HTTP-only cookie auth for browser clients over local-storage bearer tokens when the LAN/deployment setup supports it.
6. Prefer compatibility with existing admin PIN workflows during transition over removing them too early.

### Decision Boundaries

- Use secure HTTP-only cookie authentication unless implementation testing proves the deployment topology cannot support it. If cookie auth cannot be made reliable with the current CORS/hosting setup, stop and ask before switching to JWT.
- Add ASP.NET Core authentication/authorization middleware and policies rather than custom per-controller role checks.
- Keep print routes usable for the current desktop print workflows in this spec. Do not design mobile printing; mobile has no print ability.
- Admin-created users only. Do not add public registration, invite links, password reset email, or self-service account creation.
- Existing desktop route components should be protected, not rewritten.
- Existing admin PIN behavior may coexist with user auth in this phase; replacing every PIN-protected workflow with role-only authorization is a follow-up unless explicitly listed here.

## Context

The app is a React 19 + TypeScript + Vite frontend with an ASP.NET Core 9 API, EF Core 9, PostgreSQL, Tailwind CSS v4, React Router, Zustand, and Axios. The backend pattern is thin controllers returning `ApiResponse<T>`, service-layer business logic in `Infrastructure/Services`, DTOs in `Core/DTOs`, and EF entity configurations under `Infrastructure/Data/Configurations`.

Current security is mostly admin PIN based. `AdminPinActionFilter` validates `X-Admin-Pin` and `X-Admin-Reason`, and `authStore.ts` currently owns only the admin PIN modal flow. Kiosk mode is browser-local via `kioskStore.ts`; it is not a user identity system. The new auth work must introduce real stored accounts while preserving kiosk/session concepts for station operation.

The next plan files depend on this one:

- `docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md`
- `docs/plans/2026-05-05-03-camera-scanner-foundation-design.md`
- `docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md`
- `docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md`

## Requirements

1. Store app-owned user accounts in PostgreSQL with username, password hash, active/disabled state, roles, and audit timestamps.
2. Admins can create users, disable users, reset passwords, and assign roles from an authenticated admin surface.
3. There is no public self-signup.
4. The first admin account is bootstrapped from environment/configuration, not from an unauthenticated production setup page.
5. Login verifies username/password and creates a browser session usable by both desktop and future `/mobile/*` routes.
6. Logout clears the session.
7. The frontend can restore/check the current user on page reload.
8. Normal desktop app routes require authentication.
9. Backend APIs enforce authentication and role policies server-side.
10. Role policies cover at least `Admin`, `Pickup`, `LookupPrint`, `POS`, and `Reports`.
11. Unauthorized users receive clear `401` or `403` responses from APIs and friendly blocked/redirect states in the frontend.
12. Existing desktop workflows and kiosk behavior remain structurally intact after login.
13. Existing print routes remain usable for desktop print workflows in this spec; mobile printing is out of scope.
14. Existing admin PIN workflows continue to work unless a sub-spec explicitly changes them.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Backend User Model, Roles, and Bootstrap Admin

**Scope:** Add persistent user account and role data with EF Core configuration, migration, password hashing service, and initial admin bootstrap from configuration/environment.

**Files:**
- `api/src/HamptonHawksPlantSales.Core/Models/AppUser.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Models/AppUserRole.cs` (new, or equivalent owned/normalized role storage)
- `api/src/HamptonHawksPlantSales.Core/Enums/AppRole.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/DTOs/AuthDtos.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IUserService.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IPasswordHasher.cs` (new, unless using framework abstraction directly)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/AppDbContext.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/AppUserConfiguration.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/UserService.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/PasswordHasher.cs` (new, unless using framework abstraction directly)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/AuthBootstrapService.cs` (new, if bootstrap is extracted)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/*`
- `api/tests/HamptonHawksPlantSales.Tests/Services/UserServiceTests.cs` (new)

**Acceptance Criteria:**
1. `[STRUCTURAL]` `AppUser` persists username, password hash, active/disabled state, timestamps, and roles; plaintext password fields are not present on the entity.
2. `[STRUCTURAL]` EF configuration enforces case-insensitive unique usernames for non-deleted users, or equivalent normalized username uniqueness.
3. `[STRUCTURAL]` `AppRole` or equivalent role constants include `Admin`, `Pickup`, `LookupPrint`, `POS`, and `Reports`.
4. `[BEHAVIORAL]` Creating a user hashes the supplied password and never stores the raw password.
5. `[BEHAVIORAL]` Duplicate usernames are rejected with an `ApiResponse`-compatible validation/service error.
6. `[BEHAVIORAL]` Disabled users cannot authenticate.
7. `[BEHAVIORAL]` Startup/bootstrap creates or updates the configured first admin account from environment/configuration without creating duplicates on repeated starts.
8. `[MECHANICAL]` `cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UserServiceTests"` passes.

**Dependencies:** none

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. Authentication Endpoints, Cookie Session, and Policies

**Scope:** Add login/logout/current-user API endpoints, ASP.NET Core authentication/authorization middleware, cookie auth configuration, CORS credential support when required, and role policies used by later endpoint protection.

**Files:**
- `api/src/HamptonHawksPlantSales.Api/Program.cs`
- `api/src/HamptonHawksPlantSales.Api/Controllers/AuthController.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/DTOs/AuthDtos.cs`
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IUserService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/UserService.cs`
- `api/tests/HamptonHawksPlantSales.Tests/Services/AuthControllerTests.cs` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Auth/AuthPolicyTests.cs` (new, or equivalent integration/controller tests)

**Acceptance Criteria:**
1. `[STRUCTURAL]` `Program.cs` registers authentication, authorization, role policies, `UseAuthentication()`, and `UseAuthorization()` in the correct middleware order before `MapControllers()`.
2. `[STRUCTURAL]` Cookie auth is configured as the intended browser session mechanism with secure defaults appropriate to development and production.
3. `[STRUCTURAL]` CORS allows credentials only for configured allowed origins; it must not become wildcard credentials.
4. `[BEHAVIORAL]` `POST /api/auth/login` accepts username/password and returns an `ApiResponse<AuthUserResponse>` on success while setting an auth session.
5. `[BEHAVIORAL]` `POST /api/auth/logout` clears the session and returns an `ApiResponse` envelope.
6. `[BEHAVIORAL]` `GET /api/auth/me` returns the current authenticated user and roles, and returns `401` when unauthenticated.
7. `[BEHAVIORAL]` Wrong password, missing user, and disabled user login attempts fail without revealing which condition occurred.
8. `[BEHAVIORAL]` Role policies distinguish at least admin-only, pickup-capable, lookup-capable, POS-capable, and reports-capable access.
9. `[MECHANICAL]` `cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~AuthControllerTests|FullyQualifiedName~AuthPolicyTests"` passes.

**Dependencies:** sub-spec 1

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
---

### 3. Backend Route Protection and Admin User Management API

**Scope:** Protect existing API controllers with authentication/role policies and add admin-only user-management endpoints for creating, listing, disabling, password reset, and role assignment.

**Files:**
- `api/src/HamptonHawksPlantSales.Api/Controllers/UsersController.cs` (new)
- Existing API controllers under `api/src/HamptonHawksPlantSales.Api/Controllers/`
- `api/src/HamptonHawksPlantSales.Core/DTOs/UserDtos.cs` (new, or merged into `AuthDtos.cs` if cleaner)
- `api/src/HamptonHawksPlantSales.Core/Validators/*User*Validator.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IUserService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/UserService.cs`
- `api/tests/HamptonHawksPlantSales.Tests/Services/UsersControllerTests.cs` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Auth/ControllerAuthorizationTests.cs` (new)

**Acceptance Criteria:**
1. `[STRUCTURAL]` Admin-only user-management endpoints exist under a kebab-case route such as `/api/users`.
2. `[BEHAVIORAL]` Admin users can list users, create users, disable users, reset passwords, and replace/assign roles.
3. `[BEHAVIORAL]` Non-admin users receive `403` for user-management endpoints.
4. `[BEHAVIORAL]` The service prevents disabling or removing the last active admin.
5. `[BEHAVIORAL]` User-management mutations are logged through the existing admin-action pattern where practical.
6. `[STRUCTURAL]` Existing non-print API controllers require authenticated users unless a route is explicitly documented as public.
7. `[BEHAVIORAL]` Pickup/fulfillment scan endpoints require `Pickup` or `Admin`.
8. `[BEHAVIORAL]` Lookup/print station data access requires `LookupPrint`, `Pickup`, or `Admin` as appropriate to existing workflows.
9. `[BEHAVIORAL]` Reports endpoints require `Reports` or `Admin`.
10. `[BEHAVIORAL]` Settings/import/admin-action endpoints require `Admin` where they mutate or expose admin-only data.
11. `[MECHANICAL]` `cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~UsersControllerTests|FullyQualifiedName~ControllerAuthorizationTests"` passes.

**Dependencies:** sub-spec 2

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-02']
---

### 4. Frontend Auth Client, Store, Login, and Route Guards

**Scope:** Add frontend auth API helpers, session-aware Zustand state, login/logout/current-user restore, protected route wrappers, role-aware access-denied handling, and Axios credential support. Preserve existing desktop page layouts after login.

**Files:**
- `web/src/api/client.ts`
- `web/src/api/auth.ts` (new)
- `web/src/types/auth.ts` (new)
- `web/src/stores/authStore.ts` (extend or split carefully from current admin PIN modal state)
- `web/src/routes/ProtectedRoute.tsx` (new, or equivalent)
- `web/src/routes/RoleRoute.tsx` (new, or equivalent)
- `web/src/pages/auth/LoginPage.tsx` (new)
- `web/src/pages/auth/AccessDeniedPage.tsx` (new)
- `web/src/App.tsx`
- `web/src/components/shared/AdminPinModal.tsx` (only if auth store split requires import changes)
- `web/src/api/auth.test.ts` (new)
- `web/src/stores/authStore.test.ts`
- `web/src/routes/authRoutes.test.ts` (new, if helpers are extracted)

**Acceptance Criteria:**
1. `[STRUCTURAL]` Frontend auth API helpers exist for `login`, `logout`, and `me/currentUser`.
2. `[STRUCTURAL]` Axios is configured to send credentials for same-origin/authenticated API requests.
3. `[STRUCTURAL]` Existing admin PIN modal state remains functional or is moved to a clearly named store without breaking current PIN flows.
4. `[BEHAVIORAL]` Opening a protected desktop route without a session redirects to login.
5. `[BEHAVIORAL]` Successful login stores current user/roles in frontend state and returns to the intended route when safe.
6. `[BEHAVIORAL]` Page reload calls the current-user endpoint and restores the session when the cookie is valid.
7. `[BEHAVIORAL]` Logout clears frontend state and server session, then sends the user to login.
8. `[BEHAVIORAL]` Wrong-role route access shows an access-denied page with a way to return to an allowed route or logout.
9. `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/api/auth.test.ts src/stores/authStore.test.ts` passes after any updated/added tests.
10. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 2

---
sub_spec_id: SS-05
phase: run
depends_on: ['SS-03', 'SS-04']
---

### 5. Admin User Management UI and Desktop Integration

**Scope:** Add an admin-only user-management surface to the desktop app, likely under Settings or a dedicated admin route, so admins can manage station and mobile accounts without direct database access.

**Files:**
- `web/src/api/users.ts` (new)
- `web/src/types/user.ts` (new, or merged into auth types)
- `web/src/pages/admin/UserManagementPage.tsx` (new, or `SettingsPage.tsx` section if smaller)
- `web/src/pages/SettingsPage.tsx`
- `web/src/components/shared/*` as needed for forms/modals using existing Joy/touch patterns
- `web/src/api/users.test.ts` (new)
- `web/src/pages/admin/userManagementHelpers.test.ts` (new, if helpers are extracted)

**Acceptance Criteria:**
1. `[STRUCTURAL]` An admin-only user-management UI is reachable from the existing desktop app after login.
2. `[BEHAVIORAL]` Admin can create a user with username, password, active state, and roles.
3. `[BEHAVIORAL]` Admin can create station-style users such as `POS2`, `POS3`, `Pickup1`, and temporary mobile users.
4. `[BEHAVIORAL]` Admin can disable a user without deleting their audit history.
5. `[BEHAVIORAL]` Admin can reset a user's password.
6. `[BEHAVIORAL]` Admin can change roles and sees clear confirmation/errors.
7. `[BEHAVIORAL]` Non-admin users cannot see or navigate to the user-management surface.
8. `[HUMAN REVIEW]` The user-management UI is clear enough for sale-day setup: creating a mobile user on the fly should be possible without reading developer docs.
9. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 3 and sub-spec 4

---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-05']
---

### 6. End-to-End Auth Hardening and Documentation

**Scope:** Verify auth behavior across desktop, kiosk, print, and API surfaces; document setup; update environment examples; and ensure existing workflows still work after login.

**Files:**
- `README.md`
- `CLAUDE.md` if architecture rules change
- `docker-compose*.yml` and/or environment templates if first-admin configuration is added there
- `docs/cheatsheets/admin.md`
- `docs/tests/2026-05-05-user-authentication-and-roles/test-plan.md` (new)
- Optional focused Playwright/manual test notes under `docs/tests/2026-05-05-user-authentication-and-roles/`

**Acceptance Criteria:**
1. `[STRUCTURAL]` README or deployment docs describe first-admin environment/configuration values.
2. `[STRUCTURAL]` Docs describe the initial role meanings and recommended station account naming.
3. `[BEHAVIORAL]` A fresh environment can start, create/bootstrap the first admin, log in, create `POS2` or a mobile user, and log out.
4. `[BEHAVIORAL]` Existing desktop pickup, lookup/print, reports, settings, and kiosk flows remain usable after login by users with appropriate roles.
5. `[BEHAVIORAL]` Unauthenticated API calls to protected endpoints return `401`; wrong-role calls return `403`.
6. `[BEHAVIORAL]` Existing print routes remain usable for desktop print workflows according to the implementation decision documented in the spec notes.
7. `[MECHANICAL]` `cd api && dotnet test HamptonHawksPlantSales.sln` passes.
8. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 5

## Edge Cases

1. **No admin exists on first startup**  
   Bootstrap the configured first admin from environment/configuration. Repeated startups must not create duplicates.

2. **Admin tries to disable the last active admin**  
   Reject the action with a clear service/API error.

3. **Station account password is forgotten**  
   Admin resets the password from user management. Do not add email reset in this spec.

4. **Station/mobile user leaves the sale or phone is lost**  
   Admin disables the user; disabled users cannot authenticate and existing sessions should be rejected on session refresh/current-user checks.

5. **Wrong role opens a protected page**  
   Frontend shows access denied; backend returns `403` for direct API access.

6. **Unauthenticated user opens a deep desktop route**  
   Redirect to login and return to the requested route after successful login when safe.

7. **Cookie/session expires mid-workflow**  
   API returns `401`; frontend clears auth state and redirects to login without pretending a scan or mutation succeeded.

8. **CORS/credentials misconfiguration on LAN**  
   Authenticated requests should fail visibly during testing. Do not silently fall back to insecure local token storage.

9. **Existing admin PIN flows still exist**  
   They should keep working during this phase. A later spec can decide whether admin role auth replaces PIN prompts.

10. **Mobile print request**  
   Mobile has no print ability in this program. Do not add mobile print controls as part of auth.

## Out of Scope

- Mobile shell, PWA install behavior, camera scanning, mobile pickup pages, and mobile order lookup pages.
- Public user registration or invite/self-signup flows.
- Email-based password reset.
- Person-level volunteer shift tracking beyond the account username.
- OAuth, SSO, Microsoft/Google login, or external identity providers.
- Full replacement of every admin PIN-protected action with role-only auth.
- Redesigning desktop pages or kiosk layouts.
- Mobile printing.

## Constraints

### Musts

- Must use stored app-owned accounts with hashed passwords.
- Must require admin-created users; no public self-signup.
- Must protect backend APIs with server-side authorization.
- Must preserve existing desktop workflows after login.
- Must keep mobile scanning routes for later specs separate under `/mobile/*`.
- Must avoid storing plaintext passwords or long-lived secrets in local storage.
- Must retain `ApiResponse<T>` envelope conventions for new endpoints.
- Must follow thin-controller/service-layer project conventions.

### Must-Nots

- Must not rewrite the desktop app as part of auth.
- Must not break existing kiosk session behavior.
- Must not rely on frontend route hiding as the real security boundary.
- Must not allow wildcard CORS credentials.
- Must not add mobile print capability.
- Must not remove admin PIN behavior unless explicitly replaced and tested.

### Preferences

- Prefer secure HTTP-only cookie sessions.
- Prefer ASP.NET Core authorization policies over custom ad hoc role checks.
- Prefer small practical role set: `Admin`, `Pickup`, `LookupPrint`, `POS`, `Reports`.
- Prefer admin user management in Settings or an adjacent admin route.
- Prefer station-account names that match sale-day devices, such as `POS2`, `POS3`, `Pickup1`.

### Escalation Triggers

- Cookie auth cannot be made reliable in the intended local/Docker/LAN deployment.
- The implementation requires changing existing desktop route behavior beyond adding login/access-denied wrappers.
- A migration or bootstrap strategy risks locking the app with no admin user.
- Existing print routes cannot remain usable without a broader print-auth design decision.
- Replacing admin PIN flows becomes necessary to complete the work.

## Verification

1. Run `cd api && dotnet test HamptonHawksPlantSales.sln`.
2. Run `cd web && npm run build`.
3. Start the stack, configure/bootstrap the first admin, and log in on desktop.
4. Verify unauthenticated access to `/`, `/pickup`, `/lookup-print`, `/reports`, and `/settings` redirects to login.
5. Verify successful login returns to the intended route.
6. Verify an `Admin` can create `POS2` and a temporary mobile user, assign roles, reset password, disable the user, and log out.
7. Verify a disabled user cannot log in.
8. Verify a `Pickup` user can access pickup workflows but not settings/user management/reports unless granted those roles.
9. Verify a `Reports` user can access reports but cannot fulfill pickup scans or manage users.
10. Verify direct unauthenticated API calls to protected endpoints return `401`, and wrong-role calls return `403`.
11. Verify existing admin PIN prompts still work for current protected actions.
12. Verify existing desktop print workflows remain usable according to the documented route-auth decision.

## Phase Specs

Refined by `/forge-prep` on 2026-05-05.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. Backend User Model, Roles, and Bootstrap Admin | `docs/specs/user-authentication-and-roles/sub-spec-1-backend-user-model-roles-and-bootstrap-admin.md` |
| 2. Authentication Endpoints, Cookie Session, and Policies | `docs/specs/user-authentication-and-roles/sub-spec-2-authentication-endpoints-cookie-session-and-policies.md` |
| 3. Backend Route Protection and Admin User Management API | `docs/specs/user-authentication-and-roles/sub-spec-3-backend-route-protection-and-admin-user-management-api.md` |
| 4. Frontend Auth Client, Store, Login, and Route Guards | `docs/specs/user-authentication-and-roles/sub-spec-4-frontend-auth-client-store-login-and-route-guards.md` |
| 5. Admin User Management UI and Desktop Integration | `docs/specs/user-authentication-and-roles/sub-spec-5-admin-user-management-ui-and-desktop-integration.md` |
| 6. End-to-End Auth Hardening and Documentation | `docs/specs/user-authentication-and-roles/sub-spec-6-end-to-end-auth-hardening-and-documentation.md` |

Index: `docs/specs/user-authentication-and-roles/index.md`
