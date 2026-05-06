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
| Quality | 32/35 |
| Outcome Clarity | 5 |
| Scope Boundaries | 5 |
| Decision Guidance | 5 |
| Edge Coverage | 5 |
| Acceptance Criteria | 4 |
| Decomposition | 4 |
| Purpose Alignment | 4 |
| Status | Rewritten 2026-05-05 to incorporate Mobile Joy Design System (tokens, typography, paper background, hybrid nav, scene/card primitives, joy moments, scan input shell, full-Joy connection/access/login screens, tablet layout, accessibility) from updated design doc. Supersedes prior version. |

## Outcome

Add an installable, phone-first mobile shell under `/mobile/*` that uses the same authentication system as desktop, follows the Hampton Hawks Joy Pass visual direction faithfully, and provides a safe operational foundation for later camera scanner, mobile pickup, and mobile lookup specs. Done means: a phone user can install the app, launch into `/mobile`, sign in through the shared auth flow, see a Joy-styled station home with role-aware workflow cards, navigate via a sticky top app bar + drawer (phone) or permanent left rail (tablet), receive a Joy-scene treatment for connection-required and access-denied states, and never see a print control -- all without disturbing existing desktop or kiosk routes. The mobile shell is also the canonical home for the mobile design system; later mobile specs consume the tokens, components, and Joy moments defined here rather than restyling.

## Intent

### Trade-off Hierarchy

1. Preserve existing desktop and kiosk workflows over making desktop pages responsive.
2. Make mobile routes additive and isolated over sharing page components through mobile-specific conditionals.
3. Use the existing auth system from the user-auth spec over creating a mobile-only login/session path.
4. Visual fidelity to `joy-pass-demo.html` (paper background, Fraunces/Manrope typography, scene/card patterns, Joy moments) over generic mobile-app aesthetics.
5. Prefer install convenience and home-screen launch over offline capability.
6. Reuse existing Joy design tokens/components over introducing a parallel mobile token set.
7. Prefer online-only clarity over scan/order queues or cached operational data.
8. Phone-first sizing with tablet expansion (two-column layouts at >= 768px) over a single uniform layout that wastes tablet space.

### Decision Boundaries

- Use the shared `/login` from the auth spec, not a separate mobile-only authentication mechanism, unless the implemented auth spec chooses a different route contract.
- All mobile app surfaces live under `/mobile/*`.
- Do not change existing desktop route behavior except adding optional links/navigation to the mobile entry point if useful.
- Do not add mobile print ability.
- Do not cache scan, order, fulfillment, auth, report, or user-management API responses.
- Do not implement camera scanning in this spec; only create route/layout placeholders that later scanner specs can consume.
- If a service worker introduces stale authenticated data, remove or simplify it rather than building cache invalidation complexity.
- Do not introduce a parallel mobile token set; if a mobile alias is needed, add it to the shared theme so desktop and mobile stay in sync.
- Confetti is dropped from mobile MVP. Reconsider only if profiling later shows it's cheap.

### Decided (no further escalation)

- **PWA approach:** Manifest-only first. Add a service worker only if absolutely required for install behavior, and only with strict `/api/*` and operational-route bypass.
- **Login styling:** Keep one shared `/login` route; ensure it sits on the paper background and scales to phone widths. Do not fork a `/mobile/login`.
- **PWA icons:** Generate from or visually align with `web/public/hawk-logo.png`. No new branding assets required.
- **Print on mobile:** Excluded permanently from mobile shell. Print remains a desktop/kiosk concern.

## Context

The frontend is React 19, TypeScript, Vite 7, Tailwind CSS v4, React Router v7, Zustand, and Axios. The app already has `AppLayout`, `KioskLayout`, `KioskRouteGuard`, `TouchButton`, Hampton Hawks purple/gold tokens in `web/src/index.css` (`--hawk-50`...`--hawk-950`, `--gold-50`...`--gold-700`, `--paper`, `--ink`, `--rule`, `--plum-shadow`, `--press-shadow`), and bundled `@fontsource/fraunces` / `@fontsource/manrope` dependencies. The Joy design reference is `docs/plans/joy-pass-demo.html` (paper background with radial gradients, dot-grain `body::before`, sticky brand header gradient, scenes, scene-meta strip, qa-cards, three button variants, scan-input shell, checkbloom + stamp + seed Joy moments).

This spec depends on the auth foundation:

- `docs/specs/2026-05-05-user-authentication-and-roles.md`
- `docs/specs/user-authentication-and-roles/index.md`

The next specs build on this mobile shell:

- `docs/plans/2026-05-05-03-camera-scanner-foundation-design.md`
- `docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md`
- `docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md`
- `docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md`

For plan 6 (sale-day readiness), this spec must produce: a stable `/mobile` start URL, role-aware workflow card configuration, a live online/backend availability indicator, a connection-required Joy state, PWA manifest + icon assets, install behavior that opens to `/mobile`, and documentation that mobile is online-only and non-printing.

## Requirements

1. Add a mobile route tree under `/mobile/*` that is structurally separate from existing desktop routes.
2. Mobile routes use the same authenticated user/session/roles as desktop via the shared auth system.
3. Existing desktop routes (`/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk routes) keep their current layouts and components.
4. The mobile shell defines a reusable Joy mobile design layer (tokens, typography classes, paper background, scene/card primitives, button treatments, joy moments, scan-input shell) that all `/mobile/*` routes inherit.
5. Mobile-specific design aliases (`--mobile-surface`, `--mobile-surface-elevated`, `--mobile-rule`, `--mobile-touch-min`, `--mobile-radius`) are added centrally to the shared theme; no parallel mobile token set is introduced.
6. Mobile typography uses Fraunces (display) and Manrope (body) with documented size scales for phone vs. tablet, plus a monospace face for scan input.
7. Every mobile page renders on the warm paper background with the gold/hawk radial gradient atmosphere and dot-grain overlay (phone-tuned smaller than the demo).
8. Mobile navigation is hybrid: sticky top app bar + hamburger drawer on phone; permanent left rail at >= 768px viewport. There is no persistent bottom tab bar.
9. Mobile station home shows the signed-in account, a connection status indicator, and role-aware workflow entry cards using the qa-card pattern. At >= 768px it uses a two-column home grid (greeting + ribbon + primary CTA on left; stats + quick-actions on right).
10. Mobile shell is online-only: offline shows a Joy connection-required scene; backend-unavailable shows a Joy retry scene. Neither queues operations or caches operational data.
11. Wrong-role authenticated users see a Joy access-denied scene with their account identity visible and a sign-out action; no drawer is rendered.
12. Mobile implements the Joy moment components used by later specs: `Checkbloom` (scan-accepted badge), `Stamp` (order-complete), `Seed` (empty/blocked states). Confetti is excluded from MVP.
13. All Joy animations honor `prefers-reduced-motion: reduce` and degrade to the same final visual without movement.
14. A reusable scan-input shell component matches the demo's `.scan-input-shell` / `.scan-input` (gold border, paper-to-gold-50 inset, monospace inner field, gold focus ring) for use by later scanner specs.
15. Add PWA manifest support with `start_url: /mobile`, `display: standalone`, theme/background colors aligned to Hampton Hawks palette, and icons generated from or aligned with `hawk-logo.png`.
16. If a service worker is added, it must explicitly bypass `/api/*`, auth, reports, scan, fulfillment, order, user-management, and media/camera requests.
17. Mobile has no print workflow, print route, or print control anywhere in the shell.
18. Future mobile pickup, lookup, scanner, and readiness routes can plug into this shell without modifying desktop pages.
19. Build, focused unit tests, and phone+tablet viewport verification must pass.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Joy Mobile Theme Layer (tokens, typography, paper background)

**Scope:** Extend `web/src/index.css` with the centralized mobile-* aliases, document the typography scale via reusable utility classes, and add the page-level paper background + radial gradient + dot-grain primitives that all `/mobile/*` routes inherit. No mobile routes are wired yet; this sub-spec produces the design layer only.

**Files (new):**
- `web/src/styles/mobile-theme.css` (imported from `web/src/index.css`)
- `web/src/components/mobile/MobilePageBackground.tsx`
- `web/src/components/mobile/__tests__/MobilePageBackground.test.tsx`
- `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md`

**Files (modify):**
- `web/src/index.css` (add `@import "./styles/mobile-theme.css";` and central `--mobile-*` aliases)

**Acceptance Criteria:**
1. `[STRUCTURAL]` `web/src/styles/mobile-theme.css` defines `--mobile-surface`, `--mobile-surface-elevated`, `--mobile-rule`, `--mobile-touch-min: 56px`, `--mobile-radius` and is imported from `web/src/index.css`.
2. `[STRUCTURAL]` All mobile aliases reference existing tokens (e.g., `--mobile-surface: var(--paper);`); no parallel hex/rgb literals are introduced for color values that already exist in the desktop palette.
3. `[STRUCTURAL]` A `MobilePageBackground` component (or equivalent CSS utility class) renders the paper base with two soft radial gradients (~600px hawk-50 + gold-50 corners on phone, ~900px on tablet) and the 3-4% opacity dot-grain overlay via a `::before` pseudo-element.
4. `[STRUCTURAL]` Typography utilities exist for: display H1 (Fraunces, 36-40px @ 375px / 44-52px @ 430px / 64px @ tablet), section title (Fraunces 22-26px), body (Manrope >= 16px), eyebrow (Manrope 700 uppercase, .24-.28em letter-spacing, 11px, hawk-700), monospace scan (20-24px, .08em letter-spacing).
5. `[STRUCTURAL]` Numeric utility class applies `font-variant-numeric: tabular-nums`.
6. `[BEHAVIORAL]` `MobilePageBackground` renders without console errors and respects `prefers-reduced-motion` (no animated gradient shifts).
7. `[MECHANICAL]` `cd web && npm run build` exits 0.
8. `[MECHANICAL]` `cd web && npx vitest run src/components/mobile/__tests__/MobilePageBackground.test.tsx` exits 0.
9. `[STRUCTURAL]` `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss01-theme-evidence.md` exists and documents which existing tokens each `--mobile-*` alias resolves to.

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. Mobile Route Skeleton, Auth Integration, and Role-Aware Config

**Scope:** Add the `/mobile/*` route branch in `App.tsx`, a route configuration helper that maps roles -> allowed mobile workflows, an `AccessDenied` wrapper that defers to the next sub-spec for visuals, and placeholder routes for `/mobile/pickup`, `/mobile/pickup/:orderId`, and `/mobile/lookup` (rendered as "coming soon" disabled cards on the home, but registered so later specs can replace the leaf without touching `App.tsx`).

**Files (new):**
- `web/src/routes/mobileRouteConfig.ts`
- `web/src/routes/__tests__/mobileRouteConfig.test.ts`
- `web/src/pages/mobile/MobileHomePage.tsx` (placeholder shell only; SS-04 fleshes out)
- `web/src/pages/mobile/MobilePickupPlaceholderPage.tsx`
- `web/src/pages/mobile/MobileLookupPlaceholderPage.tsx`
- `web/src/routes/MobileRouteGuard.tsx`

**Files (modify):**
- `web/src/App.tsx`

**Acceptance Criteria:**
1. `[STRUCTURAL]` `App.tsx` registers a `/mobile` route branch separate from existing desktop and kiosk branches; existing desktop route definitions for `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk routes are unchanged in component reference and layout wrapper.
2. `[STRUCTURAL]` `mobileRouteConfig.ts` exports a function (e.g., `getMobileWorkflows(user)`) returning an array of `{ id, label, path, enabled, role }` keyed off the auth-spec role enum.
3. `[STRUCTURAL]` `Pickup` and `Admin` roles produce a pickup workflow entry; `LookupPrint`, `Pickup`, and `Admin` produce a lookup workflow entry; `POS`-only users produce no mobile workflow entries.
4. `[BEHAVIORAL]` Unauthenticated `/mobile` navigation routes through the shared `/login` flow from the auth spec and returns to `/mobile` after success.
5. `[BEHAVIORAL]` Authenticated users with no mobile-relevant roles render the access-denied page (visuals come from SS-03).
6. `[BEHAVIORAL]` Desktop routes `/pickup`, `/lookup-print`, `/orders`, `/reports` still render their existing layouts (regression check).
7. `[MECHANICAL]` `cd web && npx vitest run src/routes/__tests__/mobileRouteConfig.test.ts` exits 0 and tests every role-to-workflow mapping above.
8. `[MECHANICAL]` `cd web && npm run build` exits 0.

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-01', 'SS-02']
---

### 3. Mobile Layout Shell: Top Bar, Drawer, Tablet Rail, Page Transitions

**Scope:** Build `MobileLayout` with the sticky top app bar (hawk-700->hawk-950 gradient, 3px gold-300 bottom border, 48px phone / 56px tablet), the hamburger drawer (80% width, 320px max, paper surface), the permanent left rail at >= 768px (~220px, hawk-50 surface), 220ms fade+8px-translate page transitions, and iOS safe-area handling. Provide the connection status dot in the top bar (visual only -- live wiring is SS-05).

**Files (new):**
- `web/src/layouts/MobileLayout.tsx`
- `web/src/components/mobile/MobileTopBar.tsx`
- `web/src/components/mobile/MobileDrawer.tsx`
- `web/src/components/mobile/MobileTabletRail.tsx`
- `web/src/components/mobile/MobilePageTransition.tsx`
- `web/src/components/mobile/__tests__/MobileDrawer.test.tsx`

**Files (modify):**
- `web/src/routes/MobileRouteGuard.tsx` (wraps protected routes in `MobileLayout`)

**Acceptance Criteria:**
1. `[STRUCTURAL]` `MobileLayout.tsx` is a new file that does not import or modify `AppLayout` or `KioskLayout`.
2. `[STRUCTURAL]` `MobileTopBar` uses a linear-gradient background `--hawk-700` -> `--hawk-950`, a 3px solid `--gold-300` bottom border, and lays out hamburger left / station name center / connection dot right.
3. `[STRUCTURAL]` Top bar height is 48px on phone and 56px on tablet via media query at 768px.
4. `[STRUCTURAL]` `MobileDrawer` covers 80vw with 320px max-width, uses paper background, and renders Home / Pickup / Lookup / Account / Sign out items.
5. `[STRUCTURAL]` At viewport >= 768px, `MobileTabletRail` is rendered persistently at ~220px with hawk-50 background and a 1px hawk-200 right border; the drawer hamburger is hidden on tablet.
6. `[BEHAVIORAL]` Drawer dismisses via Escape key, scrim tap, and a visible close button.
7. `[BEHAVIORAL]` Page transitions use a 220ms ease-out fade + 8px upward translate; under `prefers-reduced-motion: reduce`, motion is removed but the destination route still renders.
8. `[STRUCTURAL]` Top app bar pads top by `env(safe-area-inset-top)`; page content pads bottom by `env(safe-area-inset-bottom)`.
9. `[STRUCTURAL]` Connection status dot is an 8px solid circle with three states (gold-500 online, hawk-300 checking, danger red pulsing offline). Offline pulse honors `prefers-reduced-motion`.
10. `[MECHANICAL]` `cd web && npx vitest run src/components/mobile/__tests__/MobileDrawer.test.tsx` exits 0 (covers Escape, scrim, close button dismissal).
11. `[STRUCTURAL]` Evidence file `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss03-layout-evidence.md` exists and embeds 375px and 430px viewport screenshots of the layout shell with the drawer open. PASS criterion: the captured DOM (or screenshot) shows the top bar, drawer, and scrim as three distinct stacked layers (drawer width <= 320px, scrim covers full viewport behind drawer); FAIL only if any layer is missing or the drawer extends past 80vw. Reviewer: spec author (Caleb Bennett).
12. `[STRUCTURAL]` Evidence file `ss03-layout-evidence.md` also embeds 768px and 1024px viewport screenshots. PASS criterion: at >=768px, `MobileTabletRail` is rendered (its DOM element exists with computed `display !== 'none'`) and the hamburger button has computed `display: none` (or `visibility: hidden`); FAIL only if either condition is violated. Reviewer: spec author.
13. `[MECHANICAL]` `cd web && npm run build` exits 0.

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-01', 'SS-02', 'SS-03']
---

### 4. Mobile Station Home, Quick-Action Cards, Joy Moments, Scan Input Shell

**Scope:** Flesh out `MobileHomePage` with the Joy greeting (Fraunces with gold-italic emphasis, e.g., "Good *morning*"), tabular-num quantity ribbon, role-aware quick-action cards (`qa-card` pattern: vertical layout on phone, left-edge gold->purple gradient bar that fills 0->full on press in 200ms, 40x40 hawk-50 icon tile, Fraunces 18px title, Manrope 13px description, disabled "coming soon" cards at 0.55 opacity). Build the Joy moment components (`Checkbloom`, `Stamp`, `Seed`) and the `ScanInputShell` for use by later specs. Implement the three-button variants (`MobilePrimaryButton`, `MobileGoldButton`, `MobileGhostButton`) plus the existing danger treatment.

**Files (new):**
- `web/src/components/mobile/MobileQuickActionCard.tsx`
- `web/src/components/mobile/MobileGreeting.tsx`
- `web/src/components/mobile/MobileStatsRibbon.tsx` (tabular-nums quantity strip)
- `web/src/components/mobile/joy/Checkbloom.tsx`
- `web/src/components/mobile/joy/Stamp.tsx`
- `web/src/components/mobile/joy/Seed.tsx`
- `web/src/components/mobile/joy/JoyAriaLive.tsx` (single ARIA live region wrapper)
- `web/src/components/mobile/ScanInputShell.tsx`
- `web/src/components/mobile/buttons/MobilePrimaryButton.tsx`
- `web/src/components/mobile/buttons/MobileGoldButton.tsx`
- `web/src/components/mobile/buttons/MobileGhostButton.tsx`
- `web/src/components/mobile/__tests__/MobileQuickActionCard.test.tsx`
- `web/src/components/mobile/__tests__/Checkbloom.test.tsx`

**Files (modify):**
- `web/src/pages/mobile/MobileHomePage.tsx`

**Acceptance Criteria:**
1. `[STRUCTURAL]` Quick-action cards use 14px radius, white surface on paper, a 40x40 hawk-50 icon tile, Fraunces 18px title, Manrope 13px description (#6b5573).
2. `[STRUCTURAL]` Quick-action cards have a left-edge gold->purple gradient bar that scales from 0 to full height on `:active` over 200ms; under `prefers-reduced-motion`, the bar appears at full height without animation.
3. `[STRUCTURAL]` Disabled "coming soon" quick-action cards render at 0.55 opacity, do not respond to press, and have `aria-disabled="true"`.
4. `[STRUCTURAL]` `Checkbloom` renders a 120px gold radial badge with check SVG + expanding ring; animations match the demo's `pop 480ms` and `ring 700ms`. Reduced-motion users see the badge at final scale with a static ring.
5. `[STRUCTURAL]` `Stamp` is a rotated dashed gold-600 border with Fraunces italic; phone font-size ~26px, tablet ~32px; reduced-motion variant appears un-rotated and static.
6. `[STRUCTURAL]` `Seed` is a 64-80px asymmetric gold shape with rotation/shadow used for empty states; reduced-motion variant is static.
7. `[STRUCTURAL]` `ScanInputShell` matches `.scan-input-shell` / `.scan-input`: 2px gold-300 outer border, paper-to-gold-50 inset, white inner field with 1px `--rule` border, monospace 20-24px content, eyebrow label slot above, hint slot below, focus ring of gold-500 border + 4px gold-500 alpha glow `0 0 0 4px rgba(212,160,33,.18)`.
8. `[STRUCTURAL]` `MobilePrimaryButton` uses linear-gradient hawk-600 -> hawk-800, white text, 12px radius, min-height `var(--mobile-touch-min)` (56px), gold-tinted plum shadow, and translates 1px on `:active`. Phone full-width, tablet auto-width.
9. `[STRUCTURAL]` `MobileGoldButton` uses gold-300 -> gold-500 gradient with hawk-950 text. `MobileGhostButton` uses white surface, 1px hawk-200 border, hawk-800 text.
10. `[BEHAVIORAL]` `MobileHomePage` renders the signed-in username/station identity, the connection status dot from SS-03, and only role-allowed quick-action cards from `getMobileWorkflows(user)`.
11. `[BEHAVIORAL]` `MobileHomePage` never renders any print control, print link, or print icon anywhere in its tree.
12. `[STRUCTURAL]` At viewport >= 768px, `MobileHomePage` uses a two-column grid: greeting + ribbon + primary CTA on left, stats + quick-actions on right.
13. `[STRUCTURAL]` `JoyAriaLive` provider component (rendered once at the layout level by `MobileLayout`) exposes a `useJoyAnnounce()` hook that returns `announce(message: string, opts?: { politeness?: 'polite' | 'assertive'; ttlMs?: number }) => void`. The provider renders two visually-hidden divs (`aria-live="polite" aria-atomic="true" role="status"` and `aria-live="assertive" aria-atomic="true" role="alert"`). Default politeness `'polite'`, default `ttlMs` 4000 (message clears so identical re-announces re-fire). `useJoyAnnounce()` outside the provider is a no-op (safe for unit-tested children). Tests in `web/src/components/mobile/joy/__tests__/JoyAriaLive.test.tsx` cover: (a) both regions render, (b) outside-provider hook is no-op, (c) `announce` updates polite region within one render tick, (d) `politeness: 'assertive'` updates assertive region, (e) message clears after `ttlMs`, (f) subsequent calls replace prior message.
13a. `[STRUCTURAL]` `Checkbloom`, `Stamp`, and `Seed` components MUST include a `role` attribute and/or `aria-label` if they are presentational only (e.g., `role="img" aria-label="Item accepted, check received"`). If they render an SVG, the SVG MUST have `aria-hidden="true"` and the label text MUST accompany the component via `JoyAriaLive` or an adjacent `<span>` with `sr-only` class.
13b. `[BEHAVIORAL]` `Checkbloom` calls `useJoyAnnounce()` on mount when `visible` is true, announcing `${itemName} accepted, ${remaining} remaining` (polite). Component test mocks `useJoyAnnounce` (e.g. `vi.fn()`) and asserts the call.
13c. `[BEHAVIORAL]` `Stamp` calls `useJoyAnnounce()` on mount, announcing `Order ${orderNumber} complete` (polite). Component test mocks the hook and asserts the call.
13d. `[BEHAVIORAL]` `Seed` calls `useJoyAnnounce()` on mount with its `emptyMessage` prop (polite). Component test mocks the hook and asserts the call.
13e. `[BEHAVIORAL]` `MobileLayout` calls `useJoyAnnounce()` from a `useEffect` watching the online flag, announcing `Connection restored` / `You are offline` on transition (polite). Verified by mock in `MobileLayout` test or by the SS-05 online-status integration test.
14. `[BEHAVIORAL]` All interactive controls on `MobileHomePage` have a tap target >= 44 CSS px even when visually styled smaller.
15. `[MECHANICAL]` `cd web && npx vitest run src/components/mobile/__tests__/MobileQuickActionCard.test.tsx src/components/mobile/__tests__/Checkbloom.test.tsx` exits 0.
16. `[STRUCTURAL]` Evidence file `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss04-home-evidence.md` exists and contains 375px and 430px viewport screenshots of `MobileHomePage`. Pixel-perfect parity with `joy-pass-demo.html` is NOT verified at this stage; full visual-parity verification with measurable tolerances (token references, color/geometric tolerances) is owned by SS-06 AC-12. SS-04's screenshots are inputs to that later review and only need to render without console errors at the stated viewports.
17. `[MECHANICAL]` `cd web && npm run build` exits 0.

---
sub_spec_id: SS-05
phase: run
depends_on: ['SS-01', 'SS-02', 'SS-03', 'SS-04']
---

### 5. Online-Only Guard, Joy Connection/Access/Login Scenes, PWA Manifest + Install

**Scope:** Add reusable online + backend availability hooks, render full Joy scenes for connection-required (seed empty-state, gold card, ghost retry button), backend-unavailable retry, access-denied (seed hawk-tinted variant, account identity, sign-out), and ensure the shared `/login` route sits on the paper background with the `MobilePrimaryButton` treatment when reached from `/mobile`. Add the PWA manifest with `start_url: /mobile`, theme/background colors, and icons generated from `hawk-logo.png` via ImageMagick: `convert web/public/hawk-logo.png -resize 192x192 web/public/pwa-192.png && convert web/public/hawk-logo.png -resize 512x512 web/public/pwa-512.png && convert web/public/hawk-logo.png -resize 512x512 -background none -extent 512x512 web/public/pwa-maskable-512.png`. Each resulting PNG file MUST exist, be >= 5KB, and be valid PNG format. Wire manifest into `web/index.html`. If a service worker is added, it must explicitly bypass operational endpoints.

**Files (new):**

| File | Purpose | Referenced by criteria |
|------|---------|------------------------|
| `web/src/hooks/useOnlineStatus.ts` | Reactive `{ online: boolean }` from `navigator.onLine` + window events | AC-1, AC-5, AC-7 |
| `web/src/hooks/useBackendAvailability.ts` | 30s-min poll of lightweight endpoint, exposes `{ available, lastCheckedAt, retry }` | AC-2, AC-8 |
| `web/src/hooks/__tests__/useOnlineStatus.test.ts` | Unit tests for `useOnlineStatus` (initial value, online/offline events, cleanup) | AC-15 |
| `web/src/components/mobile/MobileConnectionRequiredScene.tsx` | Full Joy scene: paper bg, Seed, Fraunces headline, gold-50 card, ghost retry, status dot | AC-3, AC-5 |
| `web/src/components/mobile/MobileBackendUnavailableScene.tsx` | Full Joy scene with retry that calls `useBackendAvailability().retry` | AC-8 |
| `web/src/components/mobile/MobileAccessDeniedScene.tsx` | Full Joy scene: hawk-tinted Seed, account identity visible, sign-out ghost button, no drawer | AC-4 |
| `web/src/pages/mobile/MobileUnavailablePage.tsx` | Page wrapper rendering `MobileAccessDeniedScene` (replaces SS-02 stub) | AC-4 |
| `web/public/manifest.webmanifest` | PWA manifest with `start_url: /mobile` | AC-9, AC-12 |
| `web/public/pwa-192.png` | 192x192 icon, generated per AC-11b | AC-11, AC-11b |
| `web/public/pwa-512.png` | 512x512 icon, generated per AC-11b | AC-11, AC-11b |
| `web/public/pwa-maskable-512.png` | 512x512 maskable icon, generated per AC-11b | AC-11, AC-11b |
| `web/src/pwa/registerServiceWorker.ts` | Conditional registration helper (only if SW shipped; otherwise omit) | AC-13 |
| `web/public/service-worker.js` | Conditional SW with explicit bypass list (only if shipped; otherwise omit) | AC-13 |

**Files (modify):**
- `web/index.html` (link manifest, theme-color meta, apple-touch-icon)
- `web/src/layouts/MobileLayout.tsx` (consume online hook for connection dot + scene swap)
- `web/src/pages/auth/LoginPage.tsx` -- the actual shared-login file (apply paper background + `MobilePrimaryButton` styling without forking the route)
- `web/package.json` (add `postinstall` script to generate PWA icons from `web/public/hawk-logo.png` via ImageMagick if the file exists and icons are missing; document in `scripts` section)

**Acceptance Criteria:**
1. `[STRUCTURAL]` `useOnlineStatus` returns a `{ online: boolean }` reactive value driven by `navigator.onLine` + `online` / `offline` window events.
2. `[STRUCTURAL]` `useBackendAvailability` polls a lightweight existing endpoint (e.g., `/health` if it exists, otherwise a HEAD against `/api/`) at most every 30s and exposes `{ available, lastCheckedAt, retry }`. Aggressive polling (<10s) is a regression.
3. `[STRUCTURAL]` `MobileConnectionRequiredScene` is a full Joy scene: paper background, `Seed` empty-state, Fraunces headline ("We need a connection"), warm gold-50 card explaining online-only, ghost retry button, and a live connection status indicator.
4. `[STRUCTURAL]` `MobileAccessDeniedScene` is a full Joy scene: paper background, hawk-tinted `Seed`, signed-in account visible, Fraunces headline ("This account doesn't have mobile access"), `MobileGhostButton` sign-out. Drawer is not rendered on this page.
5. `[BEHAVIORAL]` When `navigator.onLine === false`, `/mobile` renders `MobileConnectionRequiredScene` and does not render workflow cards, scan inputs, or any control that calls the API.
6. `[BEHAVIORAL]` Offline state never queues scans, lookups, or fulfillment; there is no "save for later" affordance.
7. `[BEHAVIORAL]` When the browser returns online, mobile pages re-render workflow cards without requiring a full reload.
8. `[BEHAVIORAL]` When backend availability check fails while browser is online, `MobileBackendUnavailableScene` renders with a retry button that re-runs the check.
9. `[STRUCTURAL]` `web/public/manifest.webmanifest` includes `name`, `short_name`, `start_url: "/mobile"`, `display: "standalone"`, `theme_color` aligned to `--hawk-800` family, `background_color` aligned to `--paper`, and an `icons` array referencing 192/512/maskable-512 PNGs.
10. `[STRUCTURAL]` `web/index.html` links the manifest via `<link rel="manifest" href="/manifest.webmanifest">`, sets a `<meta name="theme-color">` matching the manifest, and references an `apple-touch-icon`.
11. `[STRUCTURAL]` Icons exist at `web/public/pwa-192.png`, `web/public/pwa-512.png`, `web/public/pwa-maskable-512.png` and are valid PNG files generated from or visually compatible with `web/public/hawk-logo.png`. Generation command (e.g., ImageMagick) is documented in evidence.
11a. `[STRUCTURAL]` **Pre-check:** Before generating icons, verify the source file exists: `test -f web/public/hawk-logo.png && file web/public/hawk-logo.png | grep -i 'image'`. If either check fails, STOP and request the `web/public/hawk-logo.png` source file from the operator. This criterion is a gate; generation cannot proceed without a valid source.

11b. `[STRUCTURAL]` **Source and generation procedure:** The three PNG files (`pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`) are generated from `web/public/hawk-logo.png` (a pre-existing source file in the repo). Generation uses Method A (ImageMagick) if available, or Method B (manual/fallback) if not.

If `web/public/hawk-logo.png` exists and is valid, generate the three icon files using one of the following methods:

**Method A: ImageMagick (recommended if `convert` command is available)**

Before generating icons, verify that `web/public/hawk-logo.png` exists, is readable, and is a valid image file:

```bash
test -f web/public/hawk-logo.png && \
file web/public/hawk-logo.png | grep -i 'image' && \
ls -lh web/public/hawk-logo.png
```

If all checks pass, run:

```bash
convert web/public/hawk-logo.png -resize 192x192 web/public/pwa-192.png && \
convert web/public/hawk-logo.png -resize 512x512 web/public/pwa-512.png && \
convert web/public/hawk-logo.png -resize 512x512 -background none -extent 512x512 web/public/pwa-maskable-512.png
```

Verify each result:

```bash
for f in web/public/pwa-{192,512,maskable-512}.png; do
  test -f "$f" && file "$f" | grep -qi 'PNG' && echo "$f: OK" || echo "$f: FAIL"
done
```

**Method B: Fallback (if ImageMagick unavailable)**

If `convert` is not available, use an online tool (e.g., cloudconvert.com, ezgif.com, or similar) to manually resize `web/public/hawk-logo.png` to 192×192, 512×512, and 512×512 (maskable/background-removed variant) and save them to `web/public/pwa-192.png`, `web/public/pwa-512.png`, and `web/public/pwa-maskable-512.png` respectively, or use a Node.js tool (e.g., `sharp` if installed).

Each resulting file MUST:
- Exist at its specified path in `web/public/`.
- Be a valid PNG file (verified by `file` command).
- Be >= 5KB in size.
- Preserve the Hampton Hawks visual identity (logo aspect, color, theme) from the source `hawk-logo.png`.
12. `[BEHAVIORAL]` Installing the PWA on a supported browser/device launches into the mobile shell at `/mobile`, not the desktop dashboard.
13. `[STRUCTURAL]` If `web/public/service-worker.js` is shipped, its fetch handler explicitly does NOT cache or intercept requests matching `/api/*`, `/auth/*`, `/login`, `/logout`, scan/order/fulfillment routes, report routes, user-management routes, or media/camera streams. Bypass list is unit-tested or grepped in evidence.
14. `[STRUCTURAL]` Shared `/login` renders on the paper background with `MobilePrimaryButton` for the sign-in CTA when reached from `/mobile`; the login route file is not forked into a `/mobile/login`.
15. `[MECHANICAL]` `cd web && npx vitest run src/hooks/__tests__/useOnlineStatus.test.ts` exits 0.
16. `[MECHANICAL]` `cd web && npm run build` exits 0.
17. `[STRUCTURAL]` `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss05-pwa-evidence.md` records: manifest contents, icon-generation command, service-worker decision (omitted vs. shipped with bypass list), and screenshot of installed app launching `/mobile`.

---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-01', 'SS-02', 'SS-03', 'SS-04', 'SS-05']
---

### 6. Integration Wiring, Verification, and Documentation

**Scope:** Confirm the entire mobile shell wires together end-to-end (layout -> route guard -> home -> joy moments -> connection guard -> manifest), add the README/docs notes that mobile is online-only and non-printing, produce the test plan and viewport screenshots, and confirm desktop regression. This sub-spec exists to enforce the integration contract.

**Files (new):**
- `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md`
- `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` (375 / 430 / 768 / 1024 screenshots)
- `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md`

**Files (modify):**
- `README.md` (add a Mobile section: routes, online-only, no-print, install)
- `docs/cheatsheets/admin.md` if it exists (mobile install/setup quick steps)
- `CLAUDE.md` only if a new architectural rule emerges that future agents must follow (e.g., "mobile lives under `/mobile/*`, no print"); otherwise leave it.

**Acceptance Criteria:**
1. `[INTEGRATION]` Opening `/mobile` while authenticated with the `Pickup` role renders `MobileLayout` -> `MobileHomePage` with the pickup quick-action card visible and no print controls anywhere in the rendered tree.
2. `[INTEGRATION]` Opening `/mobile` while authenticated with `POS`-only role renders `MobileAccessDeniedScene` with account identity and sign-out, and does not render the drawer or any workflow card.
3. `[INTEGRATION]` Opening `/mobile` while unauthenticated routes through the shared `/login`, and after success returns to `/mobile`.
4. `[INTEGRATION]` Toggling browser offline (`navigator.onLine = false`) on `/mobile` swaps to `MobileConnectionRequiredScene`; toggling back online restores `MobileHomePage` without a manual reload.
5. `[INTEGRATION]` Stopping the backend API while keeping the browser online causes `MobileBackendUnavailableScene` to render with a working retry; restoring the API restores the home.
6. `[INTEGRATION]` Visiting `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, and kiosk routes still renders desktop/kiosk layouts unchanged (regression check captured in viewport-checks.md).
7. `[BEHAVIORAL]` `prefers-reduced-motion: reduce` applied via DevTools causes `Checkbloom`, `Stamp`, `Seed`, page transitions, and the qa-card press bar to render statically without breaking layout.
8. `[BEHAVIORAL]` `JoyAriaLive` announces auth state changes, connection state changes, and joy moments via an `aria-live="polite"` region.
9. `[STRUCTURAL]` `README.md` documents: mobile lives under `/mobile/*`, mobile is online-only, mobile has no print workflow, mobile installs via PWA manifest with `start_url: /mobile`, camera scanning will require HTTPS in a future spec.
10. `[STRUCTURAL]` `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/test-plan.md` enumerates the smoke path used by the sale-day readiness plan: open `/mobile` -> auth -> verify account visible -> verify connection visible -> verify role-allowed cards -> verify no print -> simulate offline -> verify desktop unaffected.
11. `[STRUCTURAL]` `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md` contains screenshot evidence at 375px, 430px, 768px, and 1024px showing no overlap and the correct phone-vs-tablet treatment (drawer vs. permanent rail; single-column home vs. two-column home).
12. `[STRUCTURAL]` Visual parity against `docs/plans/joy-pass-demo.html` is verified by an explicit checklist in `ss06-integration-evidence.md`. Each row below MUST be marked PASS, FAIL, or `accepted-deviation` with a screenshot-pair link; any FAIL row MUST link to a follow-up issue. `accepted-deviation` rows MUST cite a deliberate token swap with rationale. The checklist is exhaustive (no other rows count toward this criterion).

    **Tolerance rules** (apply across all rows):
    - **Color comparisons:** PASS if computed CSS color is within **±5 units per RGB channel** of the reference (or equivalently ±2% HSL lightness, ±2% saturation, ±5° hue). When the value comes from a shared CSS custom property (e.g. `var(--color-hawk-800)`), the **token reference must be exact** (string match on the `var(...)` expression); tolerance applies only to the resolved hex/rgb output.
    - **Geometric values** (border-radius, padding, margin, font-size, line-height): PASS if computed value is within **±1px** for sizes ≤ 16px or **±2px** for sizes > 16px.
    - **Typography family:** PASS if computed `font-family` includes the required family substring (e.g. `Fraunces`, `Manrope`); `font-style` and `font-weight` must string-match.
    - **Gradients and shadows:** PASS if all stop colors satisfy the color rule and stop positions are within **±2%**.
    - **Discrete properties** (`text-transform`, `letter-spacing` direction, `font-variant-numeric`, presence/absence of overlay element, role attributes): exact match required.
    - **Anti-aliasing / subpixel differences in screenshots:** not a fail signal unless the deviation is visible to a reviewer at normal viewing distance comparing captures side-by-side.
    - **Reviewer:** captures + computed-style readings reviewed by the spec author (Caleb Bennett).

    **Checklist rows** (each row records token reference, computed-style snapshot, screenshot-pair link, verdict):
    - **Header gradient:** mobile top bar background is `linear-gradient` from `--color-hawk-700` to `--color-hawk-950` with a 3px `--color-gold-300` bottom border. Token references string-match; resolved colors within color tolerance; border width within geometric tolerance.
    - **Paper background:** body/scene background resolves to `--joy-paper` (reference `#fbf7ee`) within color tolerance, and the `::before` pseudo-element grain overlay is rendered (verified by inspecting computed styles or DOM; no specific attribute required per SS-01 AC-3).
    - **Typography — Fraunces:** all H1/H2 elements in mobile scenes have `font-family` resolving to a Fraunces stack. At least one Fraunces element on `/mobile` home and on each Joy scene uses italic gold emphasis (`font-style: italic` AND resolved color is within color tolerance of a `--color-gold-*` token).
    - **Typography — Manrope:** body/UI text resolves to a Manrope stack.
    - **Button treatments:** `MobilePrimaryButton`, `MobileGhostButton`, `MobileGoldButton` rendered samples reference the demo's primary/ghost/gold tokens for background, text, and focus-ring color (token references string-match); resolved colors within color tolerance; border-radius and padding within geometric tolerance.
    - **Scene cards:** the warm explanatory card on `MobileConnectionRequiredScene` references `--color-gold-50` background (within color tolerance) and uses the same border-radius and shadow tokens as the demo card (token references string-match).
    - **Eyebrow labels:** any "eyebrow" small-caps label in a mobile scene matches the demo's `letter-spacing` (within geometric tolerance), `text-transform` (exact match), and color token (resolved within color tolerance).
    - **Focus ring:** keyboard focus outline on an interactive element on `/mobile` uses the demo's focus ring color (within color tolerance) and width (within geometric tolerance).
    - **Seed empty-state:** the `Seed` component renders with the same SVG/illustration treatment as the demo (paper variant on most scenes; hawk-tinted on `MobileAccessDeniedScene`); evidence links a side-by-side crop. PASS unless reviewer flags visible deviation per the anti-aliasing rule.
    - **Page transitions:** 220ms fade + 8px translate on route change, suppressed under `prefers-reduced-motion: reduce` (verified by recording one transition with motion enabled and one with reduce-motion enabled; both linked).

    A row is PASS only when its predicate is verifiable from the linked screenshot or DevTools computed-style capture per the tolerance rules above. "Looks like the demo" is not a pass.
13. `[MECHANICAL]` `cd web && npm run build` exits 0.
14. `[MECHANICAL]` `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` exits 0 (no API regression -- this spec is frontend-only but should not break the solution build).

## Edge Cases

1. **User opens `/mobile` before login.** Use the shared auth flow; return to `/mobile` after success.
2. **User has no mobile-relevant role.** Render `MobileAccessDeniedScene` with account identity, sign-out, and no drawer.
3. **Phone is offline.** Render `MobileConnectionRequiredScene`. Do not queue scans, lookups, or fulfillment. No "save for later" affordance.
4. **Backend is unavailable while browser is online.** Render `MobileBackendUnavailableScene` with retry. Block workflow entry points until restored.
5. **Installed PWA launches on a desktop-sized screen.** `/mobile` may render the mobile shell; do not auto-redirect to desktop. Sale-day readiness uses desktop browsers as smoke checks.
6. **Desktop user navigates current routes.** Existing desktop route components and layouts remain unchanged.
7. **User expects mobile print.** Do not add print controls. Print remains desktop/kiosk.
8. **Service worker risks caching stale auth or order data.** Default to manifest-only. If SW is shipped, bypass list above is mandatory.
9. **Small viewport text pressure.** Prefer concise mobile copy and stable fixed-format controls over reusing desktop labels.
10. **Phone rotates to landscape.** Layout remains usable; do not require landscape.
11. **Expired session inside an installed PWA.** Shell restores/checks session and routes cleanly to `/login` without a half-rendered home.
12. **Reduced-motion users.** Pop/stamp/ring/page-transition motion is removed without breaking layout; ARIA live region still announces joy moments.
13. **Confetti expectation.** Out of MVP scope; if a future spec requests it, profile first.
14. **'Online-only' interpretation.** Strict: any operational call (scan, lookup, fulfill, login, report) requires backend. Static shell assets (HTML/JS/CSS/icons) MAY load from a manifest-installed cache, but this is a static-asset cache only, not an operational cache. This disambiguation is the standing decision.

## Out of Scope

- User auth implementation (covered by the auth spec).
- Camera scanning (later scanner spec).
- Mobile pickup order fulfillment (later spec).
- Mobile order lookup behavior (later spec).
- Mobile printing (permanently excluded from mobile shell).
- Offline scan queues, offline order caches, offline lookup caches.
- Rewriting desktop pages to be responsive.
- Replacing kiosk mode.
- Adding a separate mobile frontend app/build.
- Mobile POS workflows (only added if a future spec explicitly requests them).
- Confetti Joy moment.

## Constraints

### Musts

- Must use additive `/mobile/*` routes.
- Must share auth/session/role with desktop.
- Must keep desktop and kiosk routes structurally and visually intact.
- Must be online-only for operational work.
- Must not blindly cache API responses.
- Must use the existing Hampton Hawks Joy visual vocabulary; mobile aliases extend the shared theme.
- Must support home-screen install via PWA manifest with `start_url: /mobile`.
- Must implement Joy moments (Checkbloom, Stamp, Seed) and the scan-input shell so later specs can consume them.
- Must honor `prefers-reduced-motion: reduce` across all Joy animations and page transitions.

### Must-Nots

- Must not add mobile print ability.
- Must not implement camera scanning in this spec.
- Must not introduce a parallel mobile token set or new CSS framework.
- Must not alter existing desktop pickup, lookup-print, orders, or reports workflows.
- Must not queue offline work.
- Must not cache `/api/*`, auth, scan, order, fulfillment, report, user-management, or media requests in any service worker.
- Must not fork `/mobile/login` -- reuse the shared `/login`.
- Must not include confetti in MVP.

### Preferences

- Prefer manifest-only PWA support if service-worker complexity threatens stale data.
- Prefer `MobilePrimaryButton` / `MobileGhostButton` / `MobileGoldButton` and existing Joy CSS tokens over new button/layout primitives.
- Prefer concise mobile copy over reusing desktop labels that wrap poorly.
- Prefer route-config helpers with tests for role-aware mobile navigation.
- Prefer composing existing tokens via `--mobile-*` aliases over hex literals.
- Prefer phone defaults that scale up to tablet, not tablet defaults that compress to phone.

### Escalation Triggers


- A required Joy treatment cannot be reproduced with existing tokens AND adding a new shared token would visibly diverge desktop styling.

- Browser/device behavior forces a `/mobile/login` fork to make the shared login work on phones.
- A mobile workflow card placeholder cannot be hidden/disabled cleanly and would route users into broken pages.

## Verification

1. `cd web && npm run build` exits 0.0. Generate PWA icons from `web/public/hawk-logo.png` by running:
```bash
convert web/public/hawk-logo.png -resize 192x192 web/public/pwa-192.png && \
convert web/public/hawk-logo.png -resize 512x512 web/public/pwa-512.png && \
convert web/public/hawk-logo.png -resize 512x512 -background none -extent 512x512 web/public/pwa-maskable-512.png
```
Then verify `ls -lh web/public/pwa-*.png` shows three files each >= 5KB, and `file web/public/pwa-*.png` confirms all are valid PNG format.
2. `cd web && npx vitest run` exits 0 across all new mobile tests (`mobileRouteConfig`, `useOnlineStatus`, `MobileDrawer`, `MobileQuickActionCard`, `Checkbloom`, `MobilePageBackground`).
3. `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` exits 0.
4. Start the app and log in with users from the auth spec covering at least: `Admin`, `Pickup`, `LookupPrint`, `POS`-only.
5. At 375px, 430px, 768px, 1024px viewports verify text/buttons do not overlap, drawer vs. permanent rail behavior switches at 768px, and home goes single-column -> two-column at 768px.
6. Verify role-allowed mobile workflow cards render, disallowed cards are hidden or disabled-with-`aria-disabled`, and `POS`-only sees the access-denied scene.
7. Verify mobile shows no print controls anywhere in `MobileLayout` / `MobileHomePage`.
8. Simulate offline (DevTools) and confirm `MobileConnectionRequiredScene` renders without queueing.
9. Stop the backend API while online and confirm `MobileBackendUnavailableScene` renders with retry.
10. Confirm desktop routes (`/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`) and kiosk routes still render through their existing layouts (regression).
11. Confirm `web/public/manifest.webmanifest` is linked from `web/index.html` and `start_url` is `/mobile`.
12. Install/open the PWA where supported and confirm it launches to `/mobile`.
13. Apply `prefers-reduced-motion: reduce` in DevTools and verify pop/stamp/ring/page-transition motion is removed without breaking layout.
14. Inspect ARIA live region during auth changes, connection changes, and `Checkbloom` mount to confirm announcements.
15. Visual review against `docs/plans/joy-pass-demo.html` (header gradient, paper + grain, Fraunces/Manrope, button treatments, scene cards, eyebrow labels, focus ring) -- record matched/mismatched items in `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ss06-integration-evidence.md`.
