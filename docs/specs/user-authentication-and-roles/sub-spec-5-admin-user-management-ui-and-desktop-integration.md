---
type: phase-spec
sub_spec: 5
title: "Admin User Management UI and Desktop Integration"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: [3, 4]
---

# Sub-Spec 5: Admin User Management UI and Desktop Integration

## Shared Context

Admins need to create station and mobile accounts such as `POS2`, `POS3`, `Pickup1`, and temporary mobile users without database access. This phase adds a desktop admin surface; mobile-specific pages are not included.

## Codebase Analysis

- `SettingsPage.tsx` is the existing admin-ish desktop entry point.
- Shared components include buttons, loading spinners, error banners, and modal patterns.
- API modules live in `web/src/api/`.
- Tests for API helpers and pure helper functions use Node's test runner.

## Interfaces

### Provides

- `web/src/api/users.ts`.
- User management types.
- Admin-only UI for list/create/disable/reset password/roles.

### Requires

- `/api/users` endpoints from Sub-Spec 3.
- frontend auth and admin route guards from Sub-Spec 4.

### Shared State

Admin UI uses the session auth store to verify role and shape navigation.

## Implementation Steps

### Step 1: Add users API client

**Test first**
- Create `web/src/api/users.test.ts`.
- Assert request shapes for list, create, disable/enable, reset password, and replace roles.

**Run to confirm failure**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/users.test.ts
```

**Implement**
- Add `web/src/types/user.ts`.
- Add `web/src/api/users.ts`.

**Verify**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/users.test.ts
```

### Step 2: Add user-management helpers

**Test first**
- Create `web/src/pages/admin/userManagementHelpers.test.ts`.
- Cover username validation, role checkbox normalization, station-account examples, and disabled-state labels.

**Implement**
- Add pure helpers near the page or in `web/src/pages/admin/userManagementHelpers.ts`.
- Keep validation clear but modest; backend remains authoritative.

### Step 3: Add admin UI

**Implement**
- Create `web/src/pages/admin/UserManagementPage.tsx` or add a dedicated section in `SettingsPage.tsx` if the UI remains compact.
- Prefer a dedicated route if the page grows beyond a simple settings card.
- UI requirements:
  - list users with username, active state, roles
  - create user form
  - role selection
  - disable/enable action
  - password reset action
  - clear errors/success messages
  - no public registration affordance
- Link from desktop navigation or Settings for admins only.

**Verify**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/users.test.ts src/pages/admin/userManagementHelpers.test.ts
npm run build
```

## Acceptance Checks

- Admin can create station-style users.
- Admin can disable users without deleting audit history.
- Admin can reset passwords and change roles.
- Non-admin cannot see or navigate to user management.
- Human review confirms sale-day account setup is understandable.

## Suggested Commit

`feat(auth): add admin user management UI`

