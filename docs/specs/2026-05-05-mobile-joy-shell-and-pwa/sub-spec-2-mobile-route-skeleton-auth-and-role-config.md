---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 2
title: "Mobile Route Skeleton, Auth Integration, and Role-Aware Config"
date: 2026-05-05
depends_on: ["SS-01"]
---

# Sub-Spec 2: Mobile Route Skeleton, Auth Integration, and Role-Aware Config

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Add a `/mobile/*` route branch in `web/src/App.tsx` that is structurally separate from existing desktop and kiosk branches. Build a role-aware route configuration helper, a `MobileRouteGuard` that decides whether to render the layout or the access-denied page (visuals come from SS-03/SS-05), and placeholder pages for `MobileHomePage`, `MobilePickupPlaceholderPage`, `MobileLookupPlaceholderPage` so later specs can replace leaves without touching `App.tsx`.

Key codebase findings:
- `web/src/App.tsx` registers all routes inside `<ProtectedRoute>` -> `<KioskRouteGuard>` -> `<AppShell>`. Mobile must register a sibling branch INSIDE `<ProtectedRoute>` but OUTSIDE `<KioskRouteGuard>` and `<AppShell>` (kiosk and mobile must not interact, and AppShell is desktop-only).
- `web/src/types/auth.ts` currently exports `AppRole = 'Admin' | 'Volunteer'`. The auth spec (SS-01 of `user-authentication-and-roles`) expands this to include `Admin | Pickup | LookupPrint | POS | Reports`. **Mobile depends on the expanded role set.** If this sub-spec runs before the auth-spec changes land, the `AppRole` type imports here MUST guard against the narrower set with a TODO and a fallback that treats `Admin` as the only mobile role until the expansion lands. Flag in evidence.
- `web/src/routes/RoleRoute.tsx` is the existing pattern (renders `AccessDeniedPage` on role mismatch, `<Outlet />` otherwise). `MobileRouteGuard` follows the same shape but renders `MobileLayout` (added in SS-03) instead of `<Outlet />`.
- `web/src/routes/kioskRouteConfig.ts` is the existing pattern for route-config helpers with a colocated `kioskRouteConfig.test.ts`.

## Interface Contracts

### Provides

- `web/src/routes/mobileRouteConfig.ts` exports:
  ```ts
  export interface MobileWorkflowEntry {
    id: 'pickup' | 'lookup';
    label: string;            // user-facing card label
    path: `/mobile/${string}`;
    enabled: boolean;          // false for "coming soon" placeholders
    role: AppRole;             // primary required role
    description?: string;
  }
  export function getMobileWorkflows(user: CurrentUser | null): MobileWorkflowEntry[];
  export function userHasMobileAccess(user: CurrentUser | null): boolean;
  ```
- Role -> workflow mapping (locked):
  - `Pickup` or `Admin` -> pickup entry (`enabled: false` -- placeholder until later spec replaces leaf)
  - `LookupPrint`, `Pickup`, or `Admin` -> lookup entry (`enabled: false`)
  - `POS`-only -> empty array; `userHasMobileAccess` returns false.
  - Unknown roles or `null` user -> empty array.
- `MobileRouteGuard` component (`web/src/routes/MobileRouteGuard.tsx`):
  - If `currentUser` is null and `sessionStatus === 'loading'`: render `LoadingSpinner` (`ProtectedRoute` already covers this case at the outer layer; guard remains defensive).
  - If `userHasMobileAccess(currentUser) === false`: render `<MobileUnavailablePage />` (defined in SS-05 -- for SS-02 a stub returning a placeholder div with `data-test="mobile-unavailable"` is acceptable).
  - Otherwise: render `<MobileLayout>` (defined in SS-03 -- for SS-02 import a placeholder layout that wraps `<Outlet />`).
- `App.tsx` registers:
  ```
  <Route element={<MobileRouteGuard />}>
    <Route path="mobile" element={<MobileHomePage />} />
    <Route path="mobile/pickup" element={<MobilePickupPlaceholderPage />} />
    <Route path="mobile/pickup/:orderId" element={<MobilePickupPlaceholderPage />} />
    <Route path="mobile/lookup" element={<MobileLookupPlaceholderPage />} />
  </Route>
  ```

### Requires

- From auth spec: `AppRole` includes `Pickup`, `LookupPrint`, `POS`, `Admin`, `Reports`. This sub-spec MUST NOT proceed if `web/src/types/auth.ts` still only contains `Admin | Volunteer`. If so, escalate (per master spec: "Auth spec route contracts are unavailable or change materially.") and stop with a clear TODO comment in `mobileRouteConfig.ts`.
- From SS-01: `MobilePageBackground` available (consumed indirectly via SS-03's MobileLayout, but placeholders may use it directly).
- `useAuthStore` from `web/src/stores/authStore.ts` (existing) for `currentUser`.
- `ProtectedRoute` from `web/src/routes/ProtectedRoute.tsx` (existing) handles unauth -> `/login` redirect with `state.from`. Mobile inherits this behavior automatically.

### Shared State

- Reads `useAuthStore().currentUser` (Zustand). No writes.
- Reads/writes nothing else. No new stores.

## Implementation Steps

### Step 1: Pre-flight check on AppRole
- **File:** `web/src/types/auth.ts`
- **Action:** verify
- **Run:** Manually confirm `AppRole` includes at least `'Admin'`, `'Pickup'`, `'LookupPrint'`, `'POS'`. If not, STOP and write `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss02-blocked.md` describing the missing roles, then exit with status partial.

### Step 2: Write failing test
- **File:** `web/src/routes/__tests__/mobileRouteConfig.test.ts`
- **Test names:**
  - `getMobileWorkflows returns empty array for null user`
  - `getMobileWorkflows returns empty array for POS-only user`
  - `getMobileWorkflows returns pickup entry for Pickup role`
  - `getMobileWorkflows returns pickup entry for Admin role`
  - `getMobileWorkflows returns lookup entry for LookupPrint role`
  - `getMobileWorkflows returns both entries for Admin role`
  - `userHasMobileAccess returns false for POS-only user`
  - `userHasMobileAccess returns true for Pickup user`
- **Run:** `cd web && node --test --experimental-strip-types src/routes/__tests__/mobileRouteConfig.test.ts`
- **Expected:** all tests fail (file does not exist).

### Step 3: Create mobileRouteConfig
- **File:** `web/src/routes/mobileRouteConfig.ts` (new)
- **Action:** create
- **Pattern:** Follow `web/src/routes/kioskRouteConfig.ts` (helper functions, no React).
- **Changes:** Implement `MobileWorkflowEntry`, `getMobileWorkflows`, `userHasMobileAccess` per Interface Contracts.

### Step 4: Create placeholder pages
- **Files:**
  - `web/src/pages/mobile/MobileHomePage.tsx` (new) -- renders an `<h1>` "Mobile Home" with `data-test="mobile-home"`. SS-04 fleshes out.
  - `web/src/pages/mobile/MobilePickupPlaceholderPage.tsx` (new) -- renders "Mobile pickup -- coming soon" with `data-test="mobile-pickup-placeholder"`.
  - `web/src/pages/mobile/MobileLookupPlaceholderPage.tsx` (new) -- renders "Mobile lookup -- coming soon" with `data-test="mobile-lookup-placeholder"`.
- **Pattern:** Follow `web/src/pages/auth/AccessDeniedPage.tsx` (simple named-export functional component).

### Step 5: Create MobileRouteGuard
- **File:** `web/src/routes/MobileRouteGuard.tsx` (new)
- **Action:** create
- **Pattern:** Follow `web/src/routes/RoleRoute.tsx` (named export, reads `useAuthStore`, renders `<Outlet />` or fallback).
- **Changes:**
  - Read `currentUser`, `sessionStatus`.
  - If `!userHasMobileAccess(currentUser)`: render placeholder `<MobileUnavailablePage />` (SS-02 stub: simple `<div data-test="mobile-unavailable">Mobile access not available for this account.</div>` exported from `web/src/pages/mobile/MobileUnavailablePage.tsx`). SS-05 replaces visuals.
  - Else: render `<Outlet />` -- the layout from SS-03 will wrap children once SS-03 lands. SS-02 leaves the guard as a thin `Outlet` wrapper; SS-03 modifies it to wrap `<Outlet />` in `<MobileLayout>`.

### Step 6: Register routes in App.tsx
- **File:** `web/src/App.tsx`
- **Action:** modify
- **Changes:**
  - Add imports for `MobileRouteGuard`, `MobileHomePage`, `MobilePickupPlaceholderPage`, `MobileLookupPlaceholderPage`.
  - Add the mobile route branch INSIDE `<ProtectedRoute>` and OUTSIDE `<KioskRouteGuard>`. Place it as a sibling Route element BEFORE the `<KioskRouteGuard>` wrapper so `/mobile` paths never enter kiosk-route logic.
  - Critical: do not move, rename, or alter the existing desktop and kiosk Route elements.

### Step 7: Verify all mobile tests pass
- **Run:** `cd web && node --test --experimental-strip-types src/routes/__tests__/mobileRouteConfig.test.ts`
- **Expected:** all tests pass.

### Step 8: Verify desktop regression
- **Run:** `cd web && npm run build`
- **Expected:** exit 0.
- **Manual:** spot-check `web/src/App.tsx` to confirm `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk Route elements are byte-identical aside from new sibling additions.

### Step 9: Commit
- **Stage:** `git add web/src/routes/mobileRouteConfig.ts web/src/routes/__tests__/mobileRouteConfig.test.ts web/src/routes/MobileRouteGuard.tsx web/src/pages/mobile/ web/src/App.tsx`
- **Message:** `feat: mobile route skeleton, auth integration, and role-aware config`

## Tasks

- 2.1 -- Pre-flight AppRole check
- 2.2 -- Write failing test for mobileRouteConfig
- 2.3 -- Create mobileRouteConfig
- 2.4 -- Create placeholder pages (Home, Pickup, Lookup, Unavailable)
- 2.5 -- Create MobileRouteGuard
- 2.6 -- Register routes in App.tsx
- 2.7 -- Verify mobile tests pass
- 2.8 -- Verify build and desktop regression

## Acceptance Criteria

- `[STRUCTURAL]` `App.tsx` registers a `/mobile` route branch separate from existing desktop and kiosk branches; existing desktop route definitions for `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk routes are unchanged in component reference and layout wrapper.
- `[STRUCTURAL]` `mobileRouteConfig.ts` exports a function `getMobileWorkflows(user)` returning an array of `{ id, label, path, enabled, role }` keyed off the auth-spec role enum.
- `[STRUCTURAL]` `Pickup` and `Admin` roles produce a pickup workflow entry; `LookupPrint`, `Pickup`, and `Admin` produce a lookup workflow entry; `POS`-only users produce no mobile workflow entries.
- `[BEHAVIORAL]` Unauthenticated `/mobile` navigation routes through the shared `/login` flow from the auth spec and returns to `/mobile` after success (inherited from `ProtectedRoute`).
- `[BEHAVIORAL]` Authenticated users with no mobile-relevant roles render the access-denied page (visuals come from SS-03/SS-05; SS-02 ships a stub).
- `[BEHAVIORAL]` Desktop routes `/pickup`, `/lookup-print`, `/orders`, `/reports` still render their existing layouts (regression check).
- `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/routes/__tests__/mobileRouteConfig.test.ts` exits 0 and tests every role-to-workflow mapping above. (Spec text says `npx vitest`; project uses `node --test`.)
- `[MECHANICAL]` `cd web && npm run build` exits 0.

## Completeness Checklist

`MobileWorkflowEntry` shape:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `id` | `'pickup' \| 'lookup'` | required | `MobileHomePage` (SS-04) for card key |
| `label` | `string` | required | quick-action card title |
| `path` | `` `/mobile/${string}` `` | required | router `Link` target |
| `enabled` | `boolean` | required | controls disabled "coming soon" rendering in SS-04 |
| `role` | `AppRole` | required | display + sort |
| `description` | `string` | optional | quick-action card description |

Role-to-workflow truth table:

| Role | pickup entry | lookup entry |
|------|--------------|--------------|
| `Admin` | yes | yes |
| `Pickup` | yes | yes |
| `LookupPrint` | no | yes |
| `POS` | no | no |
| `Reports` | no | no |
| (none / null) | no | no |

Resource limits / numeric boundaries:
- None introduced in SS-02.

## Verification Commands

- **Build:** `cd web && npm run build`
- **Tests:** `cd web && node --test --experimental-strip-types src/routes/__tests__/mobileRouteConfig.test.ts`
- **Acceptance:**
  - Visit `/mobile` while logged out -> redirected to `/login` (manual smoke).
  - Visit `/pickup`, `/lookup-print`, `/orders`, `/reports` and confirm no visual regression (manual smoke).

## Patterns to Follow

- `web/src/routes/kioskRouteConfig.ts` + `web/src/routes/kioskRouteConfig.test.ts`: pattern for a route-config helper module with colocated tests.
- `web/src/routes/RoleRoute.tsx`: pattern for a guard component that renders `<Outlet />` or a fallback.
- `web/src/routes/ProtectedRoute.tsx`: shows how unauth redirect works -- mobile inherits.
- `web/src/pages/auth/AccessDeniedPage.tsx`: pattern for placeholder/scene pages.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/routes/mobileRouteConfig.ts` | Create | Role -> workflow mapping helper |
| `web/src/routes/__tests__/mobileRouteConfig.test.ts` | Create | Unit tests for role mapping |
| `web/src/routes/MobileRouteGuard.tsx` | Create | Mobile route guard wrapping `Outlet` (SS-03 will inject `MobileLayout`) |
| `web/src/pages/mobile/MobileHomePage.tsx` | Create | Placeholder home (SS-04 fleshes out) |
| `web/src/pages/mobile/MobilePickupPlaceholderPage.tsx` | Create | Coming-soon placeholder |
| `web/src/pages/mobile/MobileLookupPlaceholderPage.tsx` | Create | Coming-soon placeholder |
| `web/src/pages/mobile/MobileUnavailablePage.tsx` | Create | Stub access-denied (SS-05 replaces visuals) |
| `web/src/App.tsx` | Modify | Register `/mobile/*` route branch |
