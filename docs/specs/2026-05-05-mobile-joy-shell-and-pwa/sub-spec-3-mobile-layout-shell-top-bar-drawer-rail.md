---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 3
title: "Mobile Layout Shell: Top Bar, Drawer, Tablet Rail, Page Transitions"
date: 2026-05-05
depends_on: ["SS-01", "SS-02"]
---

# Sub-Spec 3: Mobile Layout Shell

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Build `MobileLayout` as a self-contained layout component (no reuse of `AppLayout` / `KioskLayout`). It composes:
- A sticky top app bar with hawk-700 -> hawk-950 gradient, 3px gold-300 bottom border, 48px phone / 56px tablet height, hamburger left + station name center + connection-status dot right.
- A hamburger drawer (80vw, 320px max, paper surface, Home/Pickup/Lookup/Account/Sign-out items).
- A permanent left rail (~220px, hawk-50 surface, 1px hawk-200 right border) shown only at viewport >= 768px; drawer/hamburger hidden on tablet.
- 220ms ease-out fade + 8px upward translate page transitions; reduced-motion users get static rendering.
- iOS safe-area handling via `env(safe-area-inset-top|bottom)`.
- Connection status dot (visual only -- 3 states: gold-500 online, hawk-300 checking, danger red pulsing offline). Live wiring to `useOnlineStatus` is SS-05.

Codebase findings:
- `web/src/layouts/AppLayout.tsx` is the existing desktop layout pattern (gradient header with brand crest, `<Outlet />` body). MobileLayout follows similar shape but is independent.
- No drawer component exists in the codebase. Build from scratch.
- React Router v7's `useNavigation()` and `useLocation()` are available for transition triggers.
- The `joy-pass-demo.html` file at `docs/plans/joy-pass-demo.html` contains the exact gradient + scrim + button styles to mirror.

## Interface Contracts

### Provides

- `MobileLayout` component (`web/src/layouts/MobileLayout.tsx`):
  - Renders `<MobilePageBackground>` wrapping a `<div data-mobile-shell>` containing top bar, drawer, optional rail, and an `<Outlet />` wrapped in `MobilePageTransition`.
  - No props.
- `MobileTopBar` (`web/src/components/mobile/MobileTopBar.tsx`):
  - Props: `{ stationName: string; onHamburgerClick: () => void; connectionState: 'online' | 'checking' | 'offline'; isTablet: boolean }`.
  - Hides hamburger when `isTablet === true`.
- `MobileDrawer` (`web/src/components/mobile/MobileDrawer.tsx`):
  - Props: `{ open: boolean; onClose: () => void; user: CurrentUser | null; onSignOut: () => void }`.
  - Items: Home, Pickup, Lookup, Account, Sign out.
  - Dismisses via Escape key, scrim tap, visible close button.
- `MobileTabletRail` (`web/src/components/mobile/MobileTabletRail.tsx`):
  - Props: `{ user: CurrentUser | null; onSignOut: () => void }`.
  - Only renders when viewport >= 768px (consumer responsible -- component itself uses CSS media query for visibility).
- `MobilePageTransition` (`web/src/components/mobile/MobilePageTransition.tsx`):
  - Props: `{ children: ReactNode; locationKey: string }`.
  - 220ms ease-out fade + 8px upward translate. `@media (prefers-reduced-motion: reduce)` removes motion but renders destination immediately.
- `MobileConnectionDot` (inline in MobileTopBar or separate `MobileConnectionDot.tsx` -- reviewer's choice):
  - 8px solid circle, three states. Offline state pulses unless reduced-motion.
- Updated `MobileRouteGuard` (modify file from SS-02): wraps `<Outlet />` in `<MobileLayout>` when user has access.

### Requires

- From SS-01: `MobilePageBackground`, mobile token aliases.
- From SS-02: `MobileRouteGuard`, route registration, role checks.
- `useAuthStore.logout` for sign-out.
- React Router v7's `useLocation`, `Link`, `NavLink`.

### Shared State

- Drawer open/close state: local to `MobileLayout` via `useState`. No store.
- Connection state: SS-03 accepts a stubbed prop value (`'online'`); SS-05 wires the actual `useOnlineStatus` hook into `MobileLayout`.

## Implementation Steps

### Step 1: Write failing test
- **File:** `web/src/components/mobile/__tests__/MobileDrawer.test.tsx`
- **Test names:**
  - `MobileDrawer renders nothing when closed`
  - `MobileDrawer renders Home/Pickup/Lookup/Account/Sign out items when open`
  - `MobileDrawer calls onClose when Escape is pressed`
  - `MobileDrawer calls onClose when scrim is clicked`
  - `MobileDrawer calls onClose when close button is clicked`
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileDrawer.test.tsx`
- **Expected:** all fail.

### Step 2: Implement MobileTopBar
- **File:** `web/src/components/mobile/MobileTopBar.tsx` (new)
- **Pattern:** Header gradient styling from `web/src/layouts/AppLayout.tsx` lines 30-40 (crest + gradient + border-bottom).
- **Changes:** Build per Provides above. Use Tailwind classes `from-hawk-700 to-hawk-950` and a 3px solid `--color-gold-300` bottom border. Apply `padding-top: env(safe-area-inset-top)`.

### Step 3: Implement MobileDrawer
- **File:** `web/src/components/mobile/MobileDrawer.tsx` (new)
- **Changes:**
  - Fixed-position panel (left: 0, top: 0, height: 100vh, width: 80vw, max-width: 320px), paper background.
  - Scrim: fixed inset-0, semi-transparent black, click handler -> onClose.
  - Escape key listener via `useEffect` on `document`.
  - Close button: visible 44px button, top-right of panel.
  - NavLinks for Home / Pickup / Lookup; account display; Sign out button (calls `logout` then closes).
  - When `open === false`, return `null`.

### Step 4: Implement MobileTabletRail
- **File:** `web/src/components/mobile/MobileTabletRail.tsx` (new)
- **Changes:**
  - Aside element, ~220px wide, `--color-hawk-50` background, 1px `--color-hawk-200` right border, full viewport height minus top bar.
  - Same nav items as drawer; no hamburger.
  - CSS: `display: none; @media (min-width: 768px) { display: flex; }`.

### Step 5: Implement MobilePageTransition
- **File:** `web/src/components/mobile/MobilePageTransition.tsx` (new)
- **Changes:**
  - Wraps `children` in a div keyed by `locationKey`.
  - On location change, re-mounts with CSS animation: 220ms ease-out, opacity 0->1, translateY 8px -> 0.
  - `@media (prefers-reduced-motion: reduce)` overrides animation to instant.

### Step 6: Implement MobileLayout
- **File:** `web/src/layouts/MobileLayout.tsx` (new)
- **Pattern:** `web/src/layouts/AppLayout.tsx` shape (header + outlet) but built from scratch -- DO NOT import or modify AppLayout.
- **Changes:**
  - State: `drawerOpen` boolean.
  - Derive `stationName` from `useAuthStore().currentUser.displayName || 'Mobile'`.
  - Connection state: hardcode `'online'` for SS-03; SS-05 will replace with hook.
  - Renders `<MobilePageBackground>` containing `<MobileTopBar>`, `<MobileDrawer>`, `<MobileTabletRail>`, and a `<main>` containing `<MobilePageTransition>` wrapping `<Outlet />`.
  - `<main>` has `padding-bottom: env(safe-area-inset-bottom)`.
  - Tablet detection: `useMediaQuery('(min-width: 768px)')` via a small inline hook OR via CSS-only visibility (preferred -- simpler, SSR-safe).

### Step 7: Update MobileRouteGuard to wrap in MobileLayout
- **File:** `web/src/routes/MobileRouteGuard.tsx` (modify from SS-02)
- **Changes:** When access is granted, render `<MobileLayout />` (which itself contains `<Outlet />`) instead of bare `<Outlet />`.

### Step 8: Verify drawer tests pass
- **Run:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileDrawer.test.tsx`
- **Expected:** all pass.

### Step 9: Verify build
- **Run:** `cd web && npm run build`
- **Expected:** exit 0.

### Step 10: Capture viewport screenshots for human review
- **File:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss03-layout-evidence.md` (new)
- **Action:** Capture screenshots at 375px, 430px (drawer + scrim no overlap) and 768px, 1024px (rail visible, hamburger hidden). Embed images.

### Step 11: Commit
- **Stage:** `git add web/src/layouts/MobileLayout.tsx web/src/components/mobile/MobileTopBar.tsx web/src/components/mobile/MobileDrawer.tsx web/src/components/mobile/MobileTabletRail.tsx web/src/components/mobile/MobilePageTransition.tsx web/src/components/mobile/__tests__/MobileDrawer.test.tsx web/src/routes/MobileRouteGuard.tsx docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss03-layout-evidence.md`
- **Message:** `feat: mobile layout shell -- top bar, drawer, tablet rail, page transitions`

## Tasks

- 3.1 -- Write failing tests for MobileDrawer
- 3.2 -- Implement MobileTopBar
- 3.3 -- Implement MobileDrawer
- 3.4 -- Implement MobileTabletRail
- 3.5 -- Implement MobilePageTransition
- 3.6 -- Implement MobileLayout
- 3.7 -- Update MobileRouteGuard to wrap in MobileLayout
- 3.8 -- Verify drawer tests pass
- 3.9 -- Verify build
- 3.10 -- Capture viewport screenshots (ss03-layout-evidence.md)

## Acceptance Criteria

- `[STRUCTURAL]` `MobileLayout.tsx` is a new file that does not import or modify `AppLayout` or `KioskLayout`.
- `[STRUCTURAL]` `MobileTopBar` uses a linear-gradient background `--color-hawk-700` -> `--color-hawk-950`, a 3px solid `--color-gold-300` bottom border, and lays out hamburger left / station name center / connection dot right.
- `[STRUCTURAL]` Top bar height is 48px on phone and 56px on tablet via media query at 768px.
- `[STRUCTURAL]` `MobileDrawer` covers 80vw with 320px max-width, uses paper background, and renders Home / Pickup / Lookup / Account / Sign out items.
- `[STRUCTURAL]` At viewport >= 768px, `MobileTabletRail` is rendered persistently at ~220px with hawk-50 background and a 1px hawk-200 right border; the drawer hamburger is hidden on tablet.
- `[BEHAVIORAL]` Drawer dismisses via Escape key, scrim tap, and a visible close button.
- `[BEHAVIORAL]` Page transitions use a 220ms ease-out fade + 8px upward translate; under `prefers-reduced-motion: reduce`, motion is removed but the destination route still renders.
- `[STRUCTURAL]` Top app bar pads top by `env(safe-area-inset-top)`; page content pads bottom by `env(safe-area-inset-bottom)`.
- `[STRUCTURAL]` Connection status dot is an 8px solid circle with three states (gold-500 online, hawk-300 checking, danger red pulsing offline). Offline pulse honors `prefers-reduced-motion`.
- `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileDrawer.test.tsx` exits 0.
- `[HUMAN REVIEW]` At 375px and 430px viewport widths, top bar + drawer + scrim render without overlap. Reviewer confirms via screenshots in `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss03-layout-evidence.md`.
- `[HUMAN REVIEW]` At 768px and 1024px tablet widths, the left rail is visible and persistent; drawer/hamburger are hidden.
- `[MECHANICAL]` `cd web && npm run build` exits 0.

## Completeness Checklist

`MobileTopBar` props:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `stationName` | `string` | required | center label |
| `onHamburgerClick` | `() => void` | required | left button |
| `connectionState` | `'online' \| 'checking' \| 'offline'` | required | right dot |
| `isTablet` | `boolean` | required | hides hamburger on tablet |

`MobileDrawer` props:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `open` | `boolean` | required | render gate |
| `onClose` | `() => void` | required | Escape/scrim/close button handler |
| `user` | `CurrentUser \| null` | required | account display |
| `onSignOut` | `() => void` | required | Sign-out button |

Resource limits / numeric boundaries:
- Top bar height: 48px phone / 56px tablet -- enforced via media query at 768px in MobileTopBar.
- Drawer width: 80vw, max 320px -- enforced via `style={{ width: '80vw', maxWidth: '320px' }}` in MobileDrawer.
- Tablet rail width: ~220px -- enforced in MobileTabletRail.
- Page transition: 220ms ease-out, 8px translate -- enforced in MobilePageTransition CSS.
- Connection dot diameter: 8px -- enforced in MobileTopBar/MobileConnectionDot.
- Tablet breakpoint: 768px -- enforced in media queries throughout.

## Verification Commands

- **Build:** `cd web && npm run build`
- **Tests:** `cd web && node --test --experimental-strip-types src/components/mobile/__tests__/MobileDrawer.test.tsx`
- **Acceptance:**
  - DevTools 375px/430px: drawer overlay does not exceed 320px and scrim covers remaining width.
  - DevTools 768px/1024px: rail visible, hamburger hidden.
  - DevTools "Emulate prefers-reduced-motion: reduce" applied: navigate `/mobile` -> `/mobile/pickup`; new page renders without translate animation.

## Patterns to Follow

- `web/src/layouts/AppLayout.tsx`: gradient header + outlet pattern. Mirror the shape but do not import.
- `joy-pass-demo.html`: `.brand-header` gradient, `.scrim`, `.qa-card` styles, focus ring colors.
- `web/src/components/shared/`: existing component file conventions.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/layouts/MobileLayout.tsx` | Create | Composes top bar + drawer/rail + outlet + transition |
| `web/src/components/mobile/MobileTopBar.tsx` | Create | Sticky top app bar |
| `web/src/components/mobile/MobileDrawer.tsx` | Create | Phone hamburger drawer |
| `web/src/components/mobile/MobileTabletRail.tsx` | Create | Permanent left rail at >= 768px |
| `web/src/components/mobile/MobilePageTransition.tsx` | Create | 220ms fade+translate |
| `web/src/components/mobile/__tests__/MobileDrawer.test.tsx` | Create | Drawer dismissal tests |
| `web/src/routes/MobileRouteGuard.tsx` | Modify | Wrap `<Outlet />` in `<MobileLayout>` when access granted |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss03-layout-evidence.md` | Create | Viewport screenshots for human review |
