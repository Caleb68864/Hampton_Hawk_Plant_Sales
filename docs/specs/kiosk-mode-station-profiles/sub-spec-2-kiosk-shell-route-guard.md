---
type: phase-spec
sub_spec: 2
title: "Locked Kiosk Shell + Route Allowlist Enforcement"
master_spec: "docs/specs/2026-03-06-kiosk-mode-station-profiles.md"
dependencies: [1]
---

# Sub-Spec 2: Locked Kiosk Shell + Route Allowlist Enforcement

## Shared Context

See [master spec](../2026-03-06-kiosk-mode-station-profiles.md).

This phase turns the device-local kiosk session into real application behavior. The goal is not just to hide links; it is to make the router and layout actively enforce which screens are reachable for a given kiosk profile.

The current shell is wide open:
- `web/src/layouts/AppLayout.tsx` always renders the full navigation plus `GlobalQuickFind` and `QuickFindOverlay`.
- `web/src/App.tsx` routes most pages through the same layout.
- `GlobalQuickFind` currently exposes a fallback path to `/walkup/new`, which is explicitly unsafe for the first kiosk release.

Sub-spec 1 must land first so this phase has a stable `kioskStore` and a persisted `KioskSession` to read from.

## Codebase Analysis

### Existing Files

- `web/src/App.tsx` defines route structure with a single `AppLayout` for most app pages and standalone print routes.
- `web/src/layouts/AppLayout.tsx` controls the header, nav, quick find, sale-closed banner, and outlet rendering.
- `web/src/components/shared/GlobalQuickFind.tsx` is inline in the header and always visible today.
- `web/src/components/shared/QuickFindOverlay.tsx` is globally mounted and opened by keyboard shortcut.
- No kiosk-specific route config or layout exists yet.

### Patterns To Follow

- Central route registration in `App.tsx`.
- Small helper modules are acceptable when route logic becomes conditional.
- Existing shared UI is composed via layout wrappers plus route nesting.
- Current quick-find and station components already rely on React Router navigation rather than raw location mutations.

### Test Location

- Frontend pure routing helpers: `web/src/routes/*.test.ts`
- Pure navigation helpers: `web/src/hooks/*.test.ts` or colocated helper tests
- Browser/manual verification remains necessary for redirect behavior and print access

### Interfaces This Phase Must Provide

- A single source of truth that maps kiosk profiles to landing routes and allowed routes.
- A kiosk layout that can replace the normal app shell for kiosk sessions.
- A route guard that prevents direct URL access to blocked screens.

## Implementation Steps

### Step 1: Add kiosk route configuration helpers

**Test first**
- Create `web/src/routes/kioskRouteConfig.test.ts` covering:
  - landing route resolution for `pickup` and `lookup-print`
  - allowlist checks for normal app routes versus kiosk routes
  - allowed print routes for each profile
  - unknown or malformed paths returning `false`

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/routes/kioskRouteConfig.test.ts
```

**Implement**
- Create `web/src/routes/kioskRouteConfig.ts`.
- Add typed helpers such as:
  - `getKioskLandingRoute(profile)`
  - `isKioskPathAllowed(profile, pathname)`
  - `getKioskStationLabel(profile)`
  - `isKioskPrintRoute(profile, pathname)`
- Include only first-release routes:
  - `pickup`: `/pickup`, `/pickup/:orderId`, allowed print routes actually needed from pickup
  - `lookup-print`: dedicated lookup/print landing route and permitted print routes

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/routes/kioskRouteConfig.test.ts
```

**Commit**
- `feat: add kiosk route allowlist config`

---

### Step 2: Create kiosk navigation helpers and storage-sync behavior

**Test first**
- Add `web/src/hooks/useKioskNavigation.test.ts` or a pure helper test for redirect decision logic.
- Cover:
  - no kiosk session means no redirect
  - blocked route in kiosk mode resolves to landing route
  - allowed route stays put
  - print routes remain allowed

**Run to confirm failure**
```powershell
Set-Location web
 node --test --experimental-strip-types src/hooks/useKioskNavigation.test.ts
```

**Implement**
- Create `web/src/hooks/useKioskNavigation.ts`.
- Encapsulate redirect decisions so the route guard stays small.
- Include a `storage` event listener or equivalent synchronization hook so enabling/disabling kiosk in one tab updates other tabs in the same browser profile.

**Run to verify pass**
```powershell
Set-Location web
 node --test --experimental-strip-types src/hooks/useKioskNavigation.test.ts
```

**Commit**
- `feat: add kiosk navigation helper and storage sync`

---

### Step 3: Create the kiosk layout

**Test first**
- Add a simple render-level test only if practical for extracted pure helpers such as label or action rendering.
- If no useful automated test is practical, document this as a build-and-manual step and keep the logic mostly declarative.

**Run a quick baseline build**
```powershell
Set-Location web
 npm run build
```

**Implement**
- Create `web/src/layouts/KioskLayout.tsx`.
- The kiosk layout should render:
  - app title or simplified brand header
  - station label derived from the kiosk profile
  - sale-closed banner if applicable
  - a contained main outlet
  - an admin-only exit/unlock control
- Do not render:
  - global top navigation
  - `GlobalQuickFind`
  - `QuickFindOverlay`
- If `preferFullscreen` is set on the kiosk session, attempt fullscreen on mount with graceful failure.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `feat: add kiosk layout shell`

---

### Step 4: Wire App.tsx to use kiosk layout and route guard

**Test first**
- Add or extend helper tests so route resolution remains covered before touching the router.

**Run to confirm current baseline**
```powershell
Set-Location web
 npm run build
```

**Implement**
- Create `web/src/routes/KioskRouteGuard.tsx`.
- Update `web/src/App.tsx` so kiosk-eligible routes are wrapped by `KioskRouteGuard` when a kiosk session exists.
- Keep print routes accessible in kiosk mode without sending the operator through the full app shell.
- Preserve existing non-kiosk routing behavior when no kiosk session exists.
- Favor route nesting over duplicated route trees when possible.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Manual verification**
1. Enable `pickup` kiosk from Settings.
2. Refresh the browser on `/pickup` and confirm the kiosk shell is used.
3. Manually navigate to `/orders` and confirm the app redirects back to `/pickup`.
4. Open an allowed print route and confirm it still renders.

**Commit**
- `feat: enforce kiosk route restrictions in router`

---

### Step 5: Make the normal shell kiosk-aware without duplicating logic

**Test first**
- Extend pure route config tests if any new helper cases are introduced.

**Implement**
- Update `web/src/layouts/AppLayout.tsx` so it stays the normal shell only.
- Remove any assumption that quick find or header nav should render unconditionally on every app route.
- Ensure `AdminPinModal` remains globally mountable so kiosk unlock flows still work.
- Confirm the sale-closed banner logic is available to both layouts, either by duplication kept minimal or an extracted shared banner component.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `refactor: separate normal shell from kiosk shell responsibilities`

---

### Step 6: Lock down quick find and other global escape hatches

**Test first**
- Extend `web/src/routes/kioskRouteConfig.test.ts` or add a helper test to ensure kiosk mode exposes no quick-find route fallback.

**Implement**
- Update `web/src/components/shared/GlobalQuickFind.tsx` and `web/src/components/shared/QuickFindOverlay.tsx` only as needed so they are not rendered or keyboard-openable in kiosk mode.
- Do not rely on visual hiding alone; the route guard remains the source of truth.
- Keep non-kiosk behavior unchanged.

**Run to verify pass**
```powershell
Set-Location web
 npm run build
```

**Commit**
- `feat: disable global quick find in kiosk mode`

## Interface Contracts

### Provides

#### Route Config Contract
```ts
export function getKioskLandingRoute(profile: KioskProfile): string;
export function isKioskPathAllowed(profile: KioskProfile, pathname: string): boolean;
export function getKioskStationLabel(profile: KioskProfile): string;
```

#### Kiosk Layout Contract
- `KioskLayout` reads the active kiosk session from `kioskStore`.
- `KioskLayout` renders the station label and child routes.
- `KioskLayout` exposes an unlock action but no normal app navigation.

#### Route Guard Contract
- If kiosk is disabled: render children unchanged.
- If kiosk is enabled and path is allowed: render kiosk flow.
- If kiosk is enabled and path is blocked: redirect to `getKioskLandingRoute(profile)`.

### Requires

- `kioskStore` and `KioskProfile` from sub-spec 1.
- Existing React Router route structure in `App.tsx`.
- Existing admin modal for unlock actions.

### Shared State

- `App.tsx` becomes the integration point for both normal and kiosk shells.
- `kioskRouteConfig.ts` is the single allowlist that sub-spec 3 must update if station pages or print routes change.
- Both kiosk profiles depend on the same redirect contract; do not fork per-page logic.

### Verification For Dependents

Sub-spec 3 can begin when the following are true:
- kiosk sessions change the active shell on refresh
- blocked routes redirect correctly
- allowed kiosk routes remain reachable
- print routes are explicitly allowlisted

## Verification Commands

### Focused helper tests
```powershell
Set-Location web
 node --test --experimental-strip-types src/routes/kioskRouteConfig.test.ts src/hooks/useKioskNavigation.test.ts
```

### Build check
```powershell
Set-Location web
 npm run build
```

### Manual kiosk-shell checks
1. Enable `pickup` kiosk and verify the full nav is gone.
2. Attempt to reach `/settings`, `/reports`, and `/imports` directly; each should bounce back to `/pickup`.
3. Enable `lookup-print` kiosk and verify the shell label changes accordingly.
4. Confirm closing and reopening the browser keeps kiosk mode active on that browser profile.
5. Confirm print routes still open while kiosk mode remains active.
