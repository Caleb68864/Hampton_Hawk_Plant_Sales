---
type: phase-spec
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
sub_spec_number: 5
title: "Online-Only Guard, Joy Connection/Access/Login Scenes, PWA Manifest + Install"
date: 2026-05-05
depends_on: ["SS-01", "SS-02", "SS-03", "SS-04"]
---

# Sub-Spec 5: Online-Only Guard + Joy Scenes + PWA

Refined from `docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md`.

## Scope

Add the online + backend availability hooks, render full Joy scenes for connection-required, backend-unavailable, and access-denied states, restyle the shared `/login` to sit on the paper background when reached from `/mobile`, and ship the PWA manifest + icons so installing the app launches into `/mobile`.

Codebase findings:
- `web/src/hooks/` exists (sibling: `useKioskNavigation.ts`); follow that hook file pattern.
- `web/index.html` is minimal (10 lines, no manifest link, no theme-color, no icons). Must add link tags.
- `web/public/hawk-logo.png` exists at `C:\Users\CalebBennett\Documents\GitHub\Hampton_Hawk_Plant_Sales\web\public\hawk-logo.png` -- use as source for PWA icons.
- The api uses `/api/*` prefix universally (confirmed via `web/src/api/`). Health endpoint: search for any existing `/health` route -- if missing, use a HEAD against `/api/` or fall back to `GET /api/settings/public` (or whichever lightest existing endpoint the backend exposes; SS-05 worker should pick the lightest GET that returns 200 for unauth users, escalate if none exists).
- The shared `LoginPage` is `web/src/pages/auth/LoginPage.tsx` (NOT `web/src/pages/Login.tsx` as the master spec says). Restyling this file to use paper background + `MobilePrimaryButton` styling without forking the route is the correct path.

## Interface Contracts

### Provides

- `useOnlineStatus()` from `web/src/hooks/useOnlineStatus.ts`:
  - Returns `{ online: boolean }`.
  - Subscribes to window `online` and `offline` events; initial value from `navigator.onLine`.
- `useBackendAvailability()` from `web/src/hooks/useBackendAvailability.ts`:
  - Returns `{ available: boolean; lastCheckedAt: Date | null; retry: () => void }`.
  - Polls a lightweight endpoint at most every 30s. Aggressive polling (<10s) is a regression.
  - Suspends polling when `useOnlineStatus().online === false`.
- `MobileConnectionRequiredScene`: full Joy scene -- paper background, `Seed` empty-state, Fraunces headline "We need a connection", warm gold-50 card explaining online-only, ghost retry button, live connection status indicator.
- `MobileBackendUnavailableScene`: similar shell but with retry that calls `useBackendAvailability().retry`.
- `MobileAccessDeniedScene`: paper background, hawk-tinted `Seed`, signed-in account visible, Fraunces headline "This account doesn't have mobile access", `MobileGhostButton` sign-out. Drawer is NOT rendered (this scene replaces the entire layout body, including the layout shell).
- `MobileUnavailablePage`: page wrapper that renders `MobileAccessDeniedScene`. Replaces the SS-02 stub.
- PWA manifest at `web/public/manifest.webmanifest` with required fields.
- Icon assets at `web/public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`.
- `web/index.html` linking the manifest, theme-color, apple-touch-icon.
- Restyled `web/src/pages/auth/LoginPage.tsx` rendering on paper background with `MobilePrimaryButton`.
- Optional: `web/src/pwa/registerServiceWorker.ts` and `web/public/service-worker.js` ONLY if manifest-only proves insufficient. Default decision: omit. If shipped, the bypass list is mandatory and unit-tested.

### Requires

- From SS-01: paper tokens, `MobilePageBackground`.
- From SS-04: `Seed`, `MobileGhostButton`, `MobilePrimaryButton`, `JoyAriaLive`.
- From SS-03: `MobileLayout` (modified here to consume `useOnlineStatus` for connection dot + scene swap).
- From SS-02: `MobileRouteGuard` (delegates access-denied rendering to `MobileUnavailablePage`).
- A working backend or stub for backend-availability check.

### Shared State

- Browser `navigator.onLine` and window `online`/`offline` events.
- `JoyAriaLive` announces auth state changes and connection state changes (modify the layout to call `useJoyAnnounce` when `online` flips or session ends).

## Implementation Steps

### Step 1: Write failing test
- **File:** `web/src/hooks/__tests__/useOnlineStatus.test.ts`
- **Test names:**
  - `useOnlineStatus initial value reflects navigator.onLine`
  - `useOnlineStatus updates on window 'offline' event`
  - `useOnlineStatus updates on window 'online' event`
  - `useOnlineStatus cleans up listeners on unmount`
- **Run:** `cd web && node --test --experimental-strip-types src/hooks/__tests__/useOnlineStatus.test.ts`
- **Expected:** all fail.

### Step 2: Implement hooks
- **Files:** `web/src/hooks/useOnlineStatus.ts`, `web/src/hooks/useBackendAvailability.ts`
- **Pattern:** Standard React hook (`useEffect` + `useState`), no Zustand store.
- **Notes for backend hook:**
  - Choose endpoint: prefer `GET /health` if exists; else `HEAD /api/`; abort attempt after 5s timeout.
  - Polling interval: 30000ms. Pause polling when offline.
  - Treat any 2xx/3xx as available; any 5xx or network error as unavailable.

### Step 3: Implement scenes
- **Files:**
  - `web/src/components/mobile/MobileConnectionRequiredScene.tsx`
  - `web/src/components/mobile/MobileBackendUnavailableScene.tsx`
  - `web/src/components/mobile/MobileAccessDeniedScene.tsx`
- **Changes:** Each scene renders `MobilePageBackground` with centered Seed + Fraunces headline + supporting card + appropriate button. AccessDenied uses `tone="hawk"` Seed and shows `currentUser.username`.

### Step 4: Replace MobileUnavailablePage stub
- **File:** `web/src/pages/mobile/MobileUnavailablePage.tsx` (modify from SS-02)
- **Changes:** Render `<MobileAccessDeniedScene user={currentUser} onSignOut={...} />`.

### Step 5: Wire MobileLayout to online + backend hooks
- **File:** `web/src/layouts/MobileLayout.tsx` (modify from SS-03/SS-04)
- **Changes:**
  - Replace hardcoded `'online'` connection state with `useOnlineStatus()` -> derive `connectionState`.
  - If `online === false`, render `<MobileConnectionRequiredScene />` instead of the normal `<Outlet />`.
  - If `online === true && available === false`, render `<MobileBackendUnavailableScene />`.
  - Otherwise render `<Outlet />` per SS-03.
  - On `online` flip, call `useJoyAnnounce` with "Connection restored" / "You are offline".

### Step 6: Generate PWA icons
- **Files:** `web/public/pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`
- **Action:** Generate from `web/public/hawk-logo.png` using ImageMagick:
  ```
  magick web/public/hawk-logo.png -resize 192x192 web/public/pwa-192.png
  magick web/public/hawk-logo.png -resize 512x512 web/public/pwa-512.png
  magick web/public/hawk-logo.png -resize 410x410 -gravity center -background "#fbf7ee" -extent 512x512 web/public/pwa-maskable-512.png
  ```
- **Document the command in evidence.**

### Step 7: Create manifest
- **File:** `web/public/manifest.webmanifest` (new)
- **Changes:**
  ```json
  {
    "name": "Hampton Hawks Plant Sales -- Mobile",
    "short_name": "Hawks Mobile",
    "start_url": "/mobile",
    "display": "standalone",
    "theme_color": "#542569",
    "background_color": "#fbf7ee",
    "icons": [
      { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
  ```

### Step 8: Wire manifest into index.html
- **File:** `web/index.html` (modify)
- **Changes:** Inside `<head>`, add:
  ```html
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#542569" />
  <link rel="apple-touch-icon" href="/pwa-192.png" />
  ```

### Step 9: Restyle shared LoginPage
- **File:** `web/src/pages/auth/LoginPage.tsx` (modify)
- **Changes:**
  - Replace gray-50 background with `<MobilePageBackground>`-equivalent paper styling (use the same `data-mobile-bg` attribute or a paper-tinted `<div>`).
  - Replace the green submit button with `<MobilePrimaryButton type="submit">`.
  - Keep the route at `/login`. Do NOT fork to `/mobile/login`.
  - Ensure the form scales to phone widths (max-width on container; full-width inputs).

### Step 10: Verify hooks test
- **Run:** `cd web && node --test --experimental-strip-types src/hooks/__tests__/useOnlineStatus.test.ts`
- **Expected:** pass.

### Step 11: Verify build
- **Run:** `cd web && npm run build`
- **Expected:** exit 0; manifest, icons, and html updates included in `web/dist/`.

### Step 12: Decide on service worker
- **Default:** OMIT. Document decision in `ss05-pwa-evidence.md`.
- **If required:** Add `web/public/service-worker.js` with explicit fetch handler that bypasses `/api/*`, `/auth/*`, `/login`, `/logout`, scan/order/fulfillment routes, report routes, user-management routes, media/camera streams. Bypass list MUST be unit-tested or grepped in evidence.

### Step 13: Capture evidence
- **File:** `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss05-pwa-evidence.md` (new)
- **Contents:** manifest contents, icon-generation command, service-worker decision, screenshot of installed app launching `/mobile`.

### Step 14: Commit
- **Stage:** `git add web/src/hooks/useOnlineStatus.ts web/src/hooks/useBackendAvailability.ts web/src/hooks/__tests__/useOnlineStatus.test.ts web/src/components/mobile/MobileConnectionRequiredScene.tsx web/src/components/mobile/MobileBackendUnavailableScene.tsx web/src/components/mobile/MobileAccessDeniedScene.tsx web/src/pages/mobile/MobileUnavailablePage.tsx web/src/layouts/MobileLayout.tsx web/src/pages/auth/LoginPage.tsx web/public/manifest.webmanifest web/public/pwa-192.png web/public/pwa-512.png web/public/pwa-maskable-512.png web/index.html docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss05-pwa-evidence.md`
- **Message:** `feat: online-only guard, joy scenes, pwa manifest, paper-themed login`

## Tasks

- 5.1 -- Write failing test for useOnlineStatus
- 5.2 -- Implement useOnlineStatus + useBackendAvailability hooks
- 5.3 -- Implement MobileConnectionRequiredScene
- 5.4 -- Implement MobileBackendUnavailableScene
- 5.5 -- Implement MobileAccessDeniedScene + replace MobileUnavailablePage
- 5.6 -- Wire MobileLayout to hooks (scene swap + connection dot)
- 5.7 -- Generate PWA icons (pwa-192/512/maskable)
- 5.8 -- Create manifest.webmanifest
- 5.9 -- Wire manifest into web/index.html
- 5.10 -- Restyle shared LoginPage with paper background + MobilePrimaryButton
- 5.11 -- Verify hooks test
- 5.12 -- Verify build
- 5.13 -- Decide service worker (default omit)
- 5.14 -- Write ss05-pwa-evidence.md

## Acceptance Criteria

- `[STRUCTURAL]` `useOnlineStatus` returns a `{ online: boolean }` reactive value driven by `navigator.onLine` + `online` / `offline` window events.
- `[STRUCTURAL]` `useBackendAvailability` polls a lightweight existing endpoint at most every 30s and exposes `{ available, lastCheckedAt, retry }`. Aggressive polling (<10s) is a regression.
- `[STRUCTURAL]` `MobileConnectionRequiredScene` is a full Joy scene as described.
- `[STRUCTURAL]` `MobileAccessDeniedScene` is a full Joy scene with hawk-tinted Seed, account identity, sign-out, no drawer.
- `[BEHAVIORAL]` When `navigator.onLine === false`, `/mobile` renders `MobileConnectionRequiredScene` and does not render workflow cards, scan inputs, or any control that calls the API.
- `[BEHAVIORAL]` Offline state never queues scans, lookups, or fulfillment; there is no "save for later" affordance.
- `[BEHAVIORAL]` When the browser returns online, mobile pages re-render workflow cards without requiring a full reload.
- `[BEHAVIORAL]` When backend availability check fails while browser is online, `MobileBackendUnavailableScene` renders with a retry button that re-runs the check.
- `[STRUCTURAL]` `web/public/manifest.webmanifest` includes `name`, `short_name`, `start_url: "/mobile"`, `display: "standalone"`, `theme_color` aligned to `--color-hawk-800` family (`#542569`), `background_color` aligned to `--joy-paper` (`#fbf7ee`), and an `icons` array referencing 192/512/maskable-512 PNGs.
- `[STRUCTURAL]` `web/index.html` links the manifest via `<link rel="manifest" href="/manifest.webmanifest">`, sets a `<meta name="theme-color">` matching the manifest, and references an `apple-touch-icon`.
- `[STRUCTURAL]` Icons exist at `web/public/pwa-192.png`, `web/public/pwa-512.png`, `web/public/pwa-maskable-512.png`. Generation command documented in evidence.
- `[BEHAVIORAL]` Installing the PWA on a supported browser/device launches into the mobile shell at `/mobile`.
- `[STRUCTURAL]` If service worker is shipped, fetch handler explicitly does NOT cache or intercept `/api/*`, `/auth/*`, `/login`, `/logout`, scan/order/fulfillment, report, user-management, or media routes. Bypass list unit-tested or grepped in evidence.
- `[STRUCTURAL]` Shared `/login` renders on paper background with `MobilePrimaryButton` for sign-in CTA when reached from `/mobile`. Login route is not forked.
- `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/hooks/__tests__/useOnlineStatus.test.ts` exits 0.
- `[MECHANICAL]` `cd web && npm run build` exits 0.
- `[STRUCTURAL]` `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss05-pwa-evidence.md` records manifest contents, icon-generation command, service-worker decision, and install screenshot.

## Completeness Checklist

`useOnlineStatus` return type:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `online` | `boolean` | required | MobileLayout connection dot + scene swap |

`useBackendAvailability` return type:

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `available` | `boolean` | required | scene swap |
| `lastCheckedAt` | `Date \| null` | required | retry-button label "checked X seconds ago" |
| `retry` | `() => void` | required | retry button handler |

`manifest.webmanifest` fields:

| Field | Type | Required | Value |
|-------|------|----------|-------|
| `name` | string | required | "Hampton Hawks Plant Sales -- Mobile" |
| `short_name` | string | required | "Hawks Mobile" |
| `start_url` | string | required | `/mobile` |
| `display` | string | required | `standalone` |
| `theme_color` | hex | required | `#542569` (hawk-800) |
| `background_color` | hex | required | `#fbf7ee` (joy-paper) |
| `icons` | array | required | 192, 512, maskable-512 PNG entries |

Service-worker bypass list (if shipped):
- `/api/*`
- `/auth/*`
- `/login`
- `/logout`
- `/health`
- scan/order/fulfillment routes (any `/api/scan/*`, `/api/orders/*`, `/api/fulfillment/*`)
- report routes (`/api/reports/*`)
- user-management routes (`/api/users/*`, `/api/admin/*`)
- media/camera streams

Resource limits / numeric boundaries:
- Backend availability poll interval: 30000ms (minimum 10000ms; under is regression).
- Backend availability request timeout: 5000ms.
- Online status: driven by `navigator.onLine` -- no debounce.

## Verification Commands

- **Build:** `cd web && npm run build`
- **Tests:** `cd web && node --test --experimental-strip-types src/hooks/__tests__/useOnlineStatus.test.ts`
- **Acceptance:**
  - DevTools Application > Manifest: verify all manifest fields present.
  - DevTools Network > Offline: visit `/mobile`, confirm `MobileConnectionRequiredScene` renders.
  - Stop API container, visit `/mobile`, confirm `MobileBackendUnavailableScene` renders.
  - Click "Add to Home Screen" on supported device; launch and confirm URL is `/mobile`.

## Patterns to Follow

- `web/src/hooks/useKioskNavigation.ts` -- existing hook file pattern.
- `web/src/components/mobile/MobilePageBackground.tsx` (SS-01) -- paper background composition.
- `joy-pass-demo.html` -- scene visual reference.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `web/src/hooks/useOnlineStatus.ts` | Create | Browser online/offline reactive |
| `web/src/hooks/useBackendAvailability.ts` | Create | Backend health polling |
| `web/src/hooks/__tests__/useOnlineStatus.test.ts` | Create | Hook tests |
| `web/src/components/mobile/MobileConnectionRequiredScene.tsx` | Create | Joy scene for offline |
| `web/src/components/mobile/MobileBackendUnavailableScene.tsx` | Create | Joy scene for backend down |
| `web/src/components/mobile/MobileAccessDeniedScene.tsx` | Create | Joy scene for wrong role |
| `web/src/pages/mobile/MobileUnavailablePage.tsx` | Modify | Use MobileAccessDeniedScene |
| `web/src/layouts/MobileLayout.tsx` | Modify | Wire hooks for connection dot + scene swap |
| `web/src/pages/auth/LoginPage.tsx` | Modify | Paper background + MobilePrimaryButton |
| `web/public/manifest.webmanifest` | Create | PWA manifest |
| `web/public/pwa-192.png` | Create | Icon 192 |
| `web/public/pwa-512.png` | Create | Icon 512 |
| `web/public/pwa-maskable-512.png` | Create | Maskable icon |
| `web/index.html` | Modify | Link manifest, theme-color, apple-touch-icon |
| `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss05-pwa-evidence.md` | Create | PWA evidence document |
