---
type: phase-spec
sub_spec: 6
title: "End-to-End Auth Hardening and Documentation"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: [5]
---

# Sub-Spec 6: End-to-End Auth Hardening and Documentation

## Shared Context

This final phase verifies the auth system across desktop, kiosk, API, print, and admin setup. It should not add new major features. It closes gaps, documents setup, and proves the existing app still works behind login.

## Codebase Analysis

- README contains quick start, routes, deployment, and operational workflow docs.
- `CLAUDE.md` contains architecture rules that may need an auth section.
- Admin cheatsheet exists at `docs/cheatsheets/admin.md`.
- Existing test plans live under `docs/tests/`.

## Interfaces

### Provides

- Documentation for first-admin bootstrap and role meanings.
- Manual test plan for auth workflows.
- Final verification across backend and frontend.

### Requires

- All prior sub-specs.

## Implementation Steps

### Step 1: Add auth setup documentation

**Implement**
- Update `README.md` with:
  - first-admin env/config values
  - role meanings
  - station account naming examples
  - login expectations for desktop and mobile future routes
- Update Docker/env examples if bootstrap config belongs there.
- Update `CLAUDE.md` if new auth architecture rules should guide future agents.

### Step 2: Add admin operational notes

**Implement**
- Update `docs/cheatsheets/admin.md` with:
  - how to create `POS2`, `POS3`, `Pickup1`
  - how to create a temporary mobile user
  - how to disable a user
  - how to reset a password
  - reminder that there is no public self-signup

### Step 3: Add auth test plan

**Implement**
- Create `docs/tests/2026-05-05-user-authentication-and-roles/test-plan.md`.
- Include scenarios:
  - first admin bootstrap
  - desktop login/logout
  - protected route redirect
  - role denied page
  - admin creates station user
  - disabled user login failure
  - pickup role access
  - reports role access
  - direct API `401`/`403`
  - admin PIN prompt still works
  - desktop print workflow still works

### Step 4: Run full verification

**Commands**

```powershell
Set-Location api
dotnet test HamptonHawksPlantSales.sln
```

```powershell
Set-Location web
npm run build
```

**Manual/browser verification**
- Start the stack.
- Bootstrap/log in as admin.
- Create `POS2` and a temporary mobile user.
- Log in as role-limited users and verify allowed/blocked areas.
- Confirm existing kiosk and print flows behave as documented.

## Acceptance Checks

- README documents first-admin setup and role meanings.
- Admin cheatsheet covers sale-day user management.
- Test plan exists.
- API tests pass.
- Web build passes.
- Manual verification notes confirm desktop workflows remain usable.

## Suggested Commit

`docs(auth): document auth setup and verification`

