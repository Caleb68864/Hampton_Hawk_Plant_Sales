---
type: phase-spec
sub_spec: 4
title: "Frontend Auth Client, Store, Login, and Route Guards"
master_spec: "docs/specs/2026-05-05-user-authentication-and-roles.md"
dependencies: [2]
---

# Sub-Spec 4: Frontend Auth Client, Store, Login, and Route Guards

## Shared Context

This phase adds frontend auth around the existing desktop app. The desktop pages should still look and behave like themselves after login. The current `authStore.ts` is really an admin PIN modal store; preserve that behavior or split it into a clearly named store while adding session auth.

## Codebase Analysis

- API helpers live in `web/src/api/` and wrap Axios through `client.ts`.
- Zustand stores live in `web/src/stores/`.
- Route definitions are centralized in `web/src/App.tsx`.
- Route guard pattern already exists in `KioskRouteGuard.tsx`.
- Existing frontend tests use Node's built-in runner with `node --test --experimental-strip-types`.

## Interfaces

### Provides

- `web/src/api/auth.ts` with `login`, `logout`, `getCurrentUser`.
- Frontend auth types for user/roles.
- Session auth store with current user, loading/restoring state, login/logout/refresh actions.
- Protected and role route wrappers.
- Login and access-denied pages.

### Requires

- Auth endpoints from Sub-Spec 2.

### Shared State

Sub-Spec 5 uses the authenticated admin state and route guards. Later mobile specs use the same auth store.

## Implementation Steps

### Step 1: Add auth API client

**Test first**
- Create `web/src/api/auth.test.ts`.
- Assert request shapes for `login`, `logout`, and `getCurrentUser`.
- Assert credentials are included through the shared client configuration.

**Run to confirm failure**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/auth.test.ts
```

**Implement**
- Update `web/src/api/client.ts` to set `withCredentials: true`.
- Add `web/src/types/auth.ts`.
- Add `web/src/api/auth.ts`.

**Verify**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/auth.test.ts
```

### Step 2: Add session auth store without breaking admin PIN modal

**Test first**
- Extend `web/src/stores/authStore.test.ts` or create `sessionAuthStore.test.ts`.
- Cover:
  - successful login stores user
  - failed restore clears user
  - logout clears user
  - role helper detects role membership
  - admin PIN modal options still normalize correctly if same file is retained

**Implement**
- Either split existing PIN modal logic into `adminPinStore.ts` and create a new `authStore.ts`, or keep the file and add clearly separated session state.
- Avoid local storage for long-lived auth secrets. The cookie is the session.

**Verify**

```powershell
Set-Location web
node --test --experimental-strip-types src/stores/authStore.test.ts
```

### Step 3: Add login/access denied pages and route wrappers

**Test first**
- Extract pure helpers for safe return URL and role checks into a testable file, such as `web/src/routes/authRouteHelpers.ts`.
- Create `web/src/routes/authRouteHelpers.test.ts`.

**Implement**
- Add `LoginPage`.
- Add `AccessDeniedPage`.
- Add `ProtectedRoute` and `RoleRoute` or equivalent route wrappers.
- Update `App.tsx`:
  - login route stays public
  - normal app routes require auth
  - role-gated pages use role wrappers where appropriate
  - print route behavior follows master spec decision and remains usable for desktop printing
- Preserve `KioskRouteGuard` behavior inside the protected app.

**Verify**

```powershell
Set-Location web
node --test --experimental-strip-types src/api/auth.test.ts src/stores/authStore.test.ts src/routes/authRouteHelpers.test.ts
npm run build
```

## Acceptance Checks

- Unauthenticated desktop route redirects to login.
- Login restores intended route.
- Reload restores current user by calling `/api/auth/me`.
- Logout clears server and frontend session.
- Wrong-role route shows access denied.
- Admin PIN modal behavior is preserved.

## Suggested Commit

`feat(auth): add frontend login and protected routes`

