# Hampton Hawks Plant Sales -- Mobile Joy Shell and PWA

## Meta

| Field | Value |
|-------|-------|
| Client | Personal / School Fundraiser |
| Project | Hampton Hawks Plant Sales |
| Repo | Hampton_Hawk_Plant_Sales |
| Date | 2026-05-05 |
| Author | Caleb Bennett |
| Source Design | `docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md` |
| Quality | 29/30 |
| Outcome Clarity | 5 |
| Scope Boundaries | 5 |
| Decision Guidance | 5 |
| Edge Coverage | 5 |
| Acceptance Criteria | 5 |
| Decomposition | 4 |

## Outcome

Add an installable, phone-first mobile shell under `/mobile/*` that uses the same authentication system as desktop, follows the existing Joy Pass visual direction, and provides a safe route foundation for later camera scanner, mobile pickup, and mobile lookup specs. Done means mobile users can install/open the app, land on a role-aware mobile station home, see online-only connection/auth states, and navigate only to mobile workflow placeholders or enabled mobile workflows without disturbing existing desktop routes.

## Intent

### Trade-off Hierarchy

1. Preserve existing desktop and kiosk workflows over making desktop pages responsive.
2. Make mobile routes additive and isolated over sharing page components through mobile-specific conditionals.
3. Use the existing auth system from the user-auth spec over creating a mobile-only login/session path.
4. Prefer install convenience and home-screen launch over offline capability.
5. Reuse existing Joy design tokens/components over introducing a new mobile design language.
6. Prefer online-only clarity over scan/order queues or cached operational data.

### Decision Boundaries

- Use a shared `/login` from the auth spec, not a separate mobile-only authentication mechanism, unless the implemented auth spec chooses a different route contract.
- Place mobile app surfaces under `/mobile/*`.
- Do not change the existing desktop route behavior except adding links/navigation to the mobile entry point if useful.
- Do not add mobile print ability.
- Do not cache scan, order, fulfillment, auth, report, or user-management API responses.
- Do not implement camera scanning in this spec; only create route/layout placeholders that later scanner specs can consume.
- If a service worker introduces stale authenticated data, remove or simplify it rather than building cache invalidation complexity.

## Context

The frontend is React 19, TypeScript, Vite 7, Tailwind CSS v4, React Router v7, Zustand, and Axios. The app already has `AppLayout`, `KioskLayout`, `KioskRouteGuard`, `TouchButton`, Hampton Hawks purple/gold tokens in `web/src/index.css`, and bundled `@fontsource/fraunces` / `@fontsource/manrope` dependencies. The Joy design reference is `docs/plans/joy-pass-demo.html`.

This spec depends on the auth foundation:

- `docs/specs/2026-05-05-user-authentication-and-roles.md`
- `docs/specs/user-authentication-and-roles/index.md`

The next specs build on this mobile shell:

- `docs/plans/2026-05-05-03-camera-scanner-foundation-design.md`
- `docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md`
- `docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md`

## Requirements

1. Add a mobile route tree under `/mobile/*`.
2. Mobile routes use the same authenticated user/session/roles as desktop.
3. The desktop app routes remain structurally intact.
4. Mobile station home shows the signed-in account, role-aware workflow entry points, and online/connection state.
5. Mobile shell follows the Hampton Hawks Joy design: purple/gold palette, Fraunces/Manrope typography, tactile controls, warm paper-like surfaces, large touch targets.
6. Mobile shell is online-only: offline shows a connection-required state and does not queue operations.
7. Add PWA manifest support for home-screen installation.
8. PWA configuration uses a mobile start URL, standalone display, app colors, and icons.
9. If service worker support is added, it must not cache API responses or operational state.
10. Mobile has no print workflow or print controls.
11. Future mobile pickup and lookup routes can plug into this shell without changing desktop pages.
12. Build and phone viewport verification must pass.

## Sub-Specs

### 1. Mobile Route Skeleton and Auth Integration

**Scope:** Add `/mobile/*` routes, protected mobile route wrappers, mobile landing placeholders, and role-aware route decisions using the auth system from the previous spec.

**Files:**
- `web/src/App.tsx`
- `web/src/routes/mobileRouteConfig.ts` (new)
- `web/src/routes/mobileRouteConfig.test.ts` (new)
- `web/src/pages/mobile/MobileHomePage.tsx` (new)
- `web/src/pages/mobile/MobileUnavailablePage.tsx` (new, if useful)
- `web/src/layouts/MobileLayout.tsx` (new, or introduced in sub-spec 2 if cleaner)
- `web/src/types/auth.ts` from auth spec
- `web/src/stores/authStore.ts` from auth spec

**Acceptance Criteria:**
1. `[STRUCTURAL]` `App.tsx` contains a `/mobile` route branch separate from existing desktop route branches.
2. `[STRUCTURAL]` Mobile route configuration exists for at least home, pickup, and lookup entries.
3. `[BEHAVIORAL]` Unauthenticated users opening `/mobile` are routed through the shared auth flow.
4. `[BEHAVIORAL]` Authenticated users without mobile-relevant roles see a mobile access/unavailable state instead of desktop navigation.
5. `[BEHAVIORAL]` Desktop routes such as `/pickup`, `/lookup-print`, `/orders`, and `/reports` continue to use their existing layouts/components.
6. `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/routes/mobileRouteConfig.test.ts` passes.
7. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** user authentication and roles spec, especially frontend auth route guards.

---

### 2. Mobile Joy Layout and Station Home

**Scope:** Build the mobile visual shell and station home using existing Joy tokens/components. Provide phone-first navigation and placeholders for pickup/lookup until later specs fill them in.

**Files:**
- `web/src/layouts/MobileLayout.tsx` (new)
- `web/src/pages/mobile/MobileHomePage.tsx`
- `web/src/components/mobile/MobileStationCard.tsx` (new, if useful)
- `web/src/components/mobile/MobileConnectionStatus.tsx` (new, if useful)
- `web/src/styles/mobile.css` (new, only if Tailwind utility classes become unwieldy)
- `web/src/index.css`
- existing `web/src/components/shared/TouchButton.tsx`

**Acceptance Criteria:**
1. `[STRUCTURAL]` A dedicated `MobileLayout` exists and does not modify `AppLayout` or `KioskLayout`.
2. `[BEHAVIORAL]` Mobile home shows signed-in username/station identity and role-allowed workflow cards.
3. `[BEHAVIORAL]` Mobile home never shows print actions.
4. `[STRUCTURAL]` Primary mobile controls use existing `TouchButton` or equivalent 56px touch-target styling.
5. `[HUMAN REVIEW]` At common phone widths, the shell feels like the Joy demo translated to mobile: purple/gold, warm, readable, and one-hand friendly.
6. `[HUMAN REVIEW]` Text does not overlap or overflow at 375px and 430px viewport widths.
7. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 1.

---

### 3. Online-Only Guard and Backend Availability States

**Scope:** Add reusable online/backend availability handling for mobile pages. Offline should block mobile workflow actions clearly; it should not queue scans or cache operational data.

**Files:**
- `web/src/hooks/useOnlineStatus.ts` (new)
- `web/src/hooks/useBackendAvailability.ts` (new, if a backend health check is useful)
- `web/src/components/mobile/MobileConnectionRequired.tsx` (new)
- `web/src/components/mobile/MobileConnectionStatus.tsx` (new)
- `web/src/pages/mobile/MobileHomePage.tsx`
- `web/src/layouts/MobileLayout.tsx`
- `web/src/hooks/useOnlineStatus.test.ts` (new)

**Acceptance Criteria:**
1. `[STRUCTURAL]` A reusable online status hook exists for mobile pages.
2. `[BEHAVIORAL]` When the browser is offline, `/mobile` shows a clear connection-required state.
3. `[BEHAVIORAL]` Offline state does not offer queued scan, lookup, fulfillment, or print behavior.
4. `[BEHAVIORAL]` When connection returns, mobile pages can retry/continue without a full browser restart.
5. `[STRUCTURAL]` Any backend availability check uses existing `/health` or a lightweight endpoint and does not poll aggressively.
6. `[MECHANICAL]` `cd web && node --test --experimental-strip-types src/hooks/useOnlineStatus.test.ts` passes.
7. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 2.

---

### 4. PWA Manifest and Install Support

**Scope:** Add PWA manifest/icons and minimal install support for home-screen launch. This is installable-online app behavior, not offline operations.

**Files:**
- `web/public/manifest.webmanifest` (new)
- `web/public/pwa-*.png` (new, or generated from `hawk-logo.png`)
- `web/index.html`
- `web/src/pwa/registerServiceWorker.ts` (new, only if adding service worker registration)
- `web/public/service-worker.js` (new, only if adding a minimal service worker)
- `web/src/pwa/pwaConfig.test.ts` (new, if manifest config is generated from TS)

**Acceptance Criteria:**
1. `[STRUCTURAL]` Web manifest exists and is linked from `web/index.html`.
2. `[STRUCTURAL]` Manifest includes `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`, and icons.
3. `[STRUCTURAL]` Manifest `start_url` points to `/mobile`.
4. `[STRUCTURAL]` Icons exist in `web/public` and are valid static assets.
5. `[BEHAVIORAL]` Installing/opening the PWA launches the mobile shell, not the desktop dashboard.
6. `[STRUCTURAL]` If a service worker is added, it does not cache `/api/*`, auth responses, order data, scan data, fulfillment data, report data, or media streams.
7. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-spec 1.

---

### 5. Mobile Verification and Documentation

**Scope:** Add docs/test notes for mobile shell behavior and verify desktop stability, mobile viewport fit, install behavior, and online-only behavior.

**Files:**
- `README.md`
- `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` (new)
- `docs/cheatsheets/admin.md` if mobile install/setup guidance belongs there
- Optional screenshot/manual verification notes under `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/`

**Acceptance Criteria:**
1. `[STRUCTURAL]` Documentation explains that mobile lives under `/mobile/*` and desktop pages remain separate.
2. `[STRUCTURAL]` Documentation says the mobile PWA is online-only.
3. `[STRUCTURAL]` Documentation says mobile has no print workflow.
4. `[BEHAVIORAL]` Manual verification confirms `/mobile` works at 375px and 430px widths without text overlap.
5. `[BEHAVIORAL]` Manual verification confirms offline state blocks mobile workflows and does not queue work.
6. `[BEHAVIORAL]` Manual verification confirms `/pickup`, `/lookup-print`, `/orders`, and `/reports` still use desktop layouts.
7. `[MECHANICAL]` `cd web && npm run build` passes.

**Dependencies:** sub-specs 1-4.

## Edge Cases

1. **User opens `/mobile` before login**  
   Use the shared auth flow and return to `/mobile` after successful login when safe.

2. **User has no mobile-relevant role**  
   Show a mobile access/unavailable state with account identity and logout/navigation options.

3. **Phone is offline**  
   Show connection-required state. Do not queue scans, lookups, or fulfillment.

4. **Backend is unavailable while browser is online**  
   Show backend unavailable/retry messaging and block workflow entry points that require API access.

5. **Installed PWA launches on desktop-sized screen**  
   `/mobile` may still render mobile shell; do not redirect to desktop automatically unless the user explicitly navigates.

6. **Desktop user navigates current routes**  
   Existing desktop route components and layouts should remain unchanged.

7. **User expects mobile print**  
   Do not add print controls. Mobile lookup/pickup work comes in later specs; printing remains a desktop/kiosk route concern.

8. **Service worker caches stale auth or order data**  
   Avoid caching APIs entirely. If unsure, ship manifest-only install support first.

9. **Small viewport text pressure**  
   Prioritize readable labels, shorter mobile copy, and stable fixed-format controls over desktop copy reuse.

## Out of Scope

- User auth implementation itself; use the auth spec.
- Camera scanning.
- Mobile pickup order fulfillment.
- Mobile order lookup behavior.
- Mobile printing.
- Offline scan queues.
- Rewriting desktop pages to be responsive.
- Replacing kiosk mode.
- Adding a separate mobile frontend app.

## Constraints

### Musts

- Must use `/mobile/*` additive routes.
- Must share the same auth/session/role system as desktop.
- Must keep desktop routes structurally intact.
- Must be online-only for operational work.
- Must not cache API responses blindly.
- Must use existing Hampton Hawks Joy visual vocabulary.
- Must support home-screen install via PWA manifest.

### Must-Nots

- Must not add mobile print ability.
- Must not implement camera scanning in this spec.
- Must not introduce a new CSS framework or mobile-only design system.
- Must not alter existing desktop pickup, lookup-print, orders, or reports workflows.
- Must not queue offline work.
- Must not cache `/api/*` responses in a service worker.

### Preferences

- Prefer a shared `/login` route from the auth spec over `/mobile/login`.
- Prefer manifest-only PWA support if service worker complexity threatens stale data.
- Prefer `TouchButton` and existing Joy CSS tokens over new button/layout primitives.
- Prefer concise mobile copy over reusing desktop labels that wrap poorly.
- Prefer route config helpers with tests for role-aware mobile navigation.

### Escalation Triggers

- Auth spec route contracts are not available or changed materially.
- PWA install support requires service-worker caching that risks stale operational state.
- The mobile shell requires modifying desktop layouts.
- Product direction changes to require mobile printing.
- Browser install behavior cannot be validated with static manifest/icons alone.

## Verification

1. Run `cd web && npm run build`.
2. Run any new focused node tests, such as mobile route config and online status hook tests.
3. Start the app and log in with users from the auth spec.
4. Open `/mobile` at 375px and 430px widths and verify text/buttons do not overlap.
5. Verify role-allowed mobile workflow cards render and disallowed cards are hidden/disabled.
6. Verify mobile shows no print controls.
7. Simulate offline mode and confirm mobile shows connection-required messaging with no queue behavior.
8. Confirm `/pickup`, `/lookup-print`, `/orders`, and `/reports` still render through desktop layouts.
9. Confirm `manifest.webmanifest` is linked and points `start_url` to `/mobile`.
10. Install/open the PWA where possible and confirm it launches to the mobile shell.
