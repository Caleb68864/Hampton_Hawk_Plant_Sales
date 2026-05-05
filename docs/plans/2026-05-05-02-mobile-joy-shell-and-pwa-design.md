---
date: 2026-05-05
topic: "Additive mobile Joy shell and installable PWA behavior"
author: Caleb Bennett
status: draft
tags:
  - design
  - mobile
  - pwa
  - joy-pass
---

# Mobile Joy Shell And PWA -- Design

## Summary
Add a phone-first mobile shell under separate `/mobile/*` routes while preserving the desktop application and kiosk workflows. The mobile experience should follow the existing Joy Pass design direction, be installable to a phone home screen, and remain online-only for all meaningful operations.

## Approach Selected
**Additive Mobile Routes.** Mobile gets its own route tree and layout instead of turning the working desktop pages into responsive mega-components. Authentication is shared across desktop and mobile, but mobile scanning workflows are implemented as new phone-first pages.

## Architecture
```text
Shared auth system
        |
        +--> existing desktop routes after login
        |
        +--> /mobile routes after login
                |
                +--> mobile station home
                +--> mobile pickup
                +--> mobile lookup
```

Desktop pages such as `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, and report pages should keep their current layout and workflow behavior. Mobile pages should be separate routes, likely:

- shared `/login` from the auth plan
- `/mobile`
- `/mobile/pickup`
- `/mobile/pickup/:orderId`
- `/mobile/lookup`

## Components
**Mobile route shell** owns a compact authenticated layout for phones: station identity, role-aware navigation, connection status, large touch targets, and clear route transitions.

**Mobile station home** shows the signed-in account, allowed workflows, and a simple way to start pickup or lookup work. It should feel like the Joy Pass station experience translated to a phone, not like the desktop dashboard squeezed down.

**PWA manifest and install support** owns `name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `background_color`, and icons. The purpose is easy launch from a phone home screen.

**Online-only connection guard** owns the app's stance that scanning, lookup, fulfillment, login, and reporting require the backend. Offline is a clear blocked state, not a queued workflow.

**Joy mobile styling** reuses the Hampton Hawks purple/gold palette, Fraunces/Manrope typography, tactile buttons, warm paper-like surfaces, and scan feedback patterns already established by `docs/plans/joy-pass-demo.html`. The mobile shell is the canonical home for the mobile design system; later plans (scanner, pickup, lookup, readiness) consume the tokens and components defined here rather than restyling.

## Mobile Joy Design System
The mobile shell owns a reusable design layer that all `/mobile/*` routes inherit. It is a phone-first translation of `joy-pass-demo.html`, not a port of the desktop layout.

### Design Tokens
Reuse the existing tokens already defined in `web/src/index.css` (Hawk purple scale, Gold scale, paper, ink, plum-shadow, press-shadow). The shell should not introduce a parallel mobile token set. If mobile needs values the desktop tokens do not provide, add them once in the shared theme so desktop and mobile stay in sync.

Mobile-specific aliases that should be added centrally:
- `--mobile-surface` -> `--paper` (warm cream base for full-screen mobile pages)
- `--mobile-surface-elevated` -> white (cards on paper)
- `--mobile-rule` -> `--rule` (existing hairline)
- `--mobile-touch-min` -> `56px` (matches `.btn` min-height in the demo)
- `--mobile-radius` -> `14px` for cards, `12px` for buttons, `999px` for pills

### Typography
- Display: `Fraunces` (variable, optical-size 144, soft 60-80, wght 500-600). Used for page titles, plant names, order numbers, and joy moments. Italics in gold for emphasis ("Good *morning*"), matching the demo greeting.
- Body: `Manrope` 400/600/700.
- Eyebrow label: Manrope 700, uppercase, letter-spacing .24em-.28em, 11px, in `--hawk-700`.
- Numeric: `font-variant-numeric: tabular-nums` for any quantity, count, or order number.
- Monospace (scan input): `JetBrains Mono` / `Fira Code` / system mono, 20-24px, letter-spacing .08em.

Phone font sizing (one-hand readable indoors, no outdoor-glare adjustments):
- Display H1 (greeting): 36-40px on 375px width, 44-52px on 430px+, 64px on tablet two-column home.
- Section title: 22-26px (Fraunces).
- Body: 16px minimum, never below 14px for non-decorative content.
- Tap targets: minimum 44x44 CSS px, preferred 56x56 to match `.btn`.

### Background And Texture
Every mobile page uses the same warm paper background as the demo:
- Base: `--paper` (#fbf7ee).
- Two soft radial gradients in hawk-50 and gold-50 corners (smaller and more subtle on phones than the demo's 1200px radii — use ~600px on phone, ~900px on tablet so they read as atmosphere rather than spotlights).
- Faint paper-grain overlay via `body::before` 3px radial dot pattern at 4-5% opacity, multiply blend, behind content.
- Pages should not use plain white backgrounds; cards float on the paper.

### Layout And Navigation
Hybrid nav, no persistent bottom tab bar:
- Sticky top app bar, ~48px tall on phone, ~56px on tablet. Linear gradient from `--hawk-700` to `--hawk-950` with a 3px gold-300 bottom border (the demo's `.brand-header` compressed). Layout: hamburger left, station name center (Manrope 700, 14px on phone), connection status dot right.
- Hamburger opens a drawer covering 80% of viewport width (max 320px). Drawer items: Home, Pickup, Lookup, Account, Sign out. Drawer surface uses paper background and the same Joy card treatment.
- Tablet (>= 768px): drawer becomes a permanent left rail (~220px wide) with the same items always visible. Rail uses a soft hawk-50 surface with a hawk-200 right border.
- Workflow-driven returns: scan order -> scan plants -> complete -> return to lookup. Completion screen exposes "Open next order" (primary) and "Back to lookup" (ghost). The user does not need the drawer for normal flow.
- Connection status dot: 8px solid circle, gold-500 when online, hawk-300 muted when checking, danger red with subtle pulse when offline.
- Page transitions: fade + 8px upward translate, 220ms ease-out. No long slide animations.
- Safe-area: respect iOS notch via `env(safe-area-inset-top/bottom)`; the top bar pads top inset, the page content pads bottom inset.

### Surfaces, Cards, And Scenes
Every mobile workflow renders inside a "scene" container modeled on `.scene` from the demo:
- White surface, 1px `--rule` border, 18px radius, `--plum-shadow`.
- Optional scene-meta strip with `--gold-50` background, dashed bottom rule, eyebrow label, and a small uppercase pill (route name or status).
- Inner padding: 20-24px on phone (down from the demo's 28-32px).
- Scenes stack vertically with 20px gap on phone, 28-36px on tablet.

Quick-action cards (mobile station home) follow `.qa-card`:
- Vertical layout on phone (icon top, title, description), 14px radius, white surface.
- Left-edge gold->purple gradient bar that scales from 0 -> full height on press (200ms) instead of hover.
- 40x40 icon tile in `--hawk-50`, hawk-700 stroke icon.
- Title in Fraunces 18px, description in Manrope 13px `#6b5573`.
- Disabled "coming soon" cards use 0.55 opacity and disable the press animation, matching how the demo greys out option D.

### Buttons
Three variants from the demo, mobile-tuned:
- Primary: linear-gradient hawk-600 -> hawk-800, white text, 12px radius, 56px min-height, gold-tinted plum shadow underneath. `:active` translates 1px down (existing demo behavior).
- Gold (override / accent): gold-300 -> gold-500 gradient, hawk-950 text. Reserved for admin overrides and decisive actions ("Manager override").
- Ghost: white surface, 1px hawk-200 border, hawk-800 text. Used for secondary actions ("Back to lookup", "Skip plant").
- Danger: kept available for destructive actions; mobile rarely needs it but should not invent its own treatment.
- Full-width buttons on phone for primary CTAs; auto-width on tablet.

### Joy Moments (Phone-Tuned)
Keep three of the four demo moments on mobile MVP. Drop confetti.

- **Checkbloom (scan accepted):** the demo's `.checkbloom` 148px gold radial badge with check SVG and expanding ring. On phone, scale to 120px to leave room for plant name and remaining-pill below. Animation: `pop 480ms` and `ring 700ms` exactly as the demo. This is the high-frequency moment — it must feel identical to the demo.
- **Stamp (order complete):** `.stamp` rotated dashed gold-600 stamp with Fraunces italic. Scale to ~26px font on phone, ~32px on tablet. Keep the `stamp 380ms` animation.
- **Seed (empty state):** the asymmetric gold seed shape with rotation and shadow. Used for "no orders match", "lookup has no results", and the no-mobile-roles access-denied state. 64-80px on phone.
- **Confetti:** dropped on phone for MVP. Battery, rendering cost, and sale-day distraction outweigh the delight on small screens. Reconsider after MVP if profiling shows it is cheap.

All Joy animations must respect `prefers-reduced-motion: reduce` and degrade to the same visual without movement (badge appears at final scale, stamp appears un-rotated, ring is static).

### Scan Input And Manual Entry
Match the demo's `.scan-input-shell` and `.scan-input` patterns when manual entry surfaces in any mobile workflow:
- Gold-300 2px outer border with a soft inset paper-to-gold-50 gradient.
- Inner field: white, 1px rule border, monospace, 20-24px text. Focus ring uses gold-500 border and 4px gold-500 alpha glow (`0 0 0 4px rgba(212,160,33,.18)`).
- Eyebrow label above ("Scan order sheet, customer pick list, ...").
- Hint text under in `#7a5b85`, 13px.

### Connection-Required, Access-Denied, Login Screens
These are full Joy scenes, not utility screens.
- **Connection required:** seed empty-state pattern, Fraunces headline ("We need a connection"), warm gold card explaining mobile is online-only, retry button (ghost) and a connection status indicator that updates live.
- **Access denied (wrong role):** seed empty-state with hawk-tinted variant, signed-in account visible, Fraunces headline ("This account doesn't have mobile access"), and a Sign-out ghost button. No drawer is shown.
- **Login (when reached from `/mobile`):** keep the shared `/login` route but ensure the existing form sits on the paper background, scales to fill viewport on phones, uses the `.btn-primary` treatment for sign-in, and shows the crest dot and station eyebrow above the form.

### Tablet Layout
Tablets (>= 768px) use the extra space rather than just stretching the phone layout:
- Permanent left nav rail replaces the drawer.
- Mobile station home becomes the demo's two-column `.home-grid`: greeting + ribbon + primary CTA on the left, stats card + quick-actions grid on the right.
- Mobile pickup uses two columns: scanner/manual entry on the left, order progress + last-scanned card on the right (mirrors `.scan-ready`).
- Mobile lookup uses two columns at landscape tablet width: search input on the left, result cards on the right.
- Joy moments (checkbloom, stamp) stay centered in the active workspace column rather than spanning the full screen.

### Accessibility
- Color contrast: hawk-800/900 text on paper meets AA at 16px+. Eyebrow labels in hawk-700 on white meet AA. Gold-on-paper is decorative only — never put body copy in gold-400 or lighter on paper.
- Every Joy moment has an accessible status update via ARIA live region (e.g., "Coleus 'Wizard Mix' accepted, 3 remaining").
- Hamburger drawer is dismissable via Escape, scrim tap, and a visible close button.
- Tap targets meet 44px minimum even when visually styled smaller.
- `prefers-reduced-motion` removes pop/stamp/ring/page-transition motion.

## Contract With Prior And Later Plans
This plan depends on `2026-05-05-01-user-authentication-and-roles-design.md`. The mobile shell should not invent a separate login, token store, or role model. It consumes the shared authenticated user and role helpers from the auth implementation.

This plan provides the route and operational shell for:

- `2026-05-05-03-camera-scanner-foundation-design.md`
- `2026-05-05-04-mobile-pickup-scan-workflow-design.md`
- `2026-05-05-05-mobile-order-lookup-workflow-design.md`
- `2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md`

For plan 6, this plan should produce concrete readiness hooks:

- a stable `/mobile` start URL
- role-aware mobile workflow card configuration
- an online/backend availability indicator
- a connection-required state
- PWA manifest and icon assets
- install/open behavior that starts on `/mobile`
- documentation or code comments explaining that mobile is online-only and non-printing

Mobile workflow placeholders should be safe. If pickup/lookup are not implemented yet, cards can render as disabled or "coming soon" based on route availability, but they should not route users into broken pages.

## Data Flow
Installed app opens to the mobile start URL, loads static assets, checks network and auth state, then routes the user to login or a role-allowed mobile page.

```text
Installed mobile app opens
        |
        v
load shell/static assets
        |
        v
check online/auth/session
        |
        +--> offline -> connection required
        +--> unauthenticated -> login
        +--> authenticated -> role-allowed mobile route
```

PWA behavior should not cache scan, order, fulfillment, auth, or report API responses. If a service worker is added, it should cache only the application shell/static assets conservatively.

## PWA And Deployment Guardrails
- Prefer manifest-only install support first. Add a service worker only if it remains simple and cannot cache operational data.
- Manifest `start_url` should be `/mobile`.
- Manifest `display` should be `standalone`.
- `theme_color` should align with Hampton Hawks purple and `background_color` with the warm paper/gold shell.
- Icons should be generated from or visually compatible with existing Hampton Hawks branding, such as `hawk-logo.png`.
- The mobile shell should be built assuming phones open a LAN/prod hostname, not `localhost`.
- Camera scanning later requires HTTPS or another browser-accepted secure context; this shell should document that requirement even before scanner implementation.
- Do not rely on offline caches. If the app cannot reach the backend, mobile workflows are blocked.
- If service worker support is added, explicitly bypass `/api/*`, auth, reports, scan, fulfillment, order, user-management, and media/camera requests.

## Mobile Route And Role Guardrails
- `/mobile` is the mobile station home.
- `/mobile/pickup` and `/mobile/pickup/:orderId` are reserved for the mobile pickup plan.
- `/mobile/lookup` is reserved for the mobile order lookup plan.
- Mobile has no print route, print action, or print workflow.
- Users with no mobile-relevant roles should see a mobile-specific unavailable/access-denied state.
- `Pickup` and `Admin` should see pickup-oriented entry points once implemented.
- `LookupPrint`, `Pickup`, and `Admin` may see lookup-oriented entry points depending on final role policy.
- `POS` should only see POS/mobile register entry points if a future mobile POS workflow is explicitly added.

## Error Handling
- Offline state shows a clear connection-required message.
- Backend unavailable shows retry messaging and does not allow local scan completion.
- Wrong-role users see a mobile access-denied page with account identity visible.
- Expired sessions redirect to login.
- Mobile layout must keep touch controls large enough for one-hand use.
- Text must fit without overlap on common phone widths.
- If the PWA is opened while already authenticated but the backend session has expired, the shell should restore/check session and then route to login cleanly.
- If the app is installed before the backend URL/HTTPS setup is corrected, the shell should fail visibly rather than appearing half-ready.
- If a user rotates the phone, text and controls should remain usable; do not require landscape mode.
- If a user opens `/mobile` on desktop, it may render the mobile shell; do not auto-redirect to desktop because plan 6 may use desktop browser tools for smoke checks.

## Verification Notes
Add focused verification for:

- `/mobile` route exists and uses a mobile-specific layout
- desktop route layout remains unchanged
- unauthenticated `/mobile` uses shared auth
- wrong-role `/mobile` shows mobile unavailable/access-denied state styled as a Joy seed scene
- offline browser state blocks mobile workflows with the Joy connection-required scene
- backend unavailable state is visible
- manifest exists and points to `/mobile`
- no print controls render in the mobile shell
- 375px and 430px viewport checks
- 768px and 1024px tablet viewport checks confirm two-column home and permanent nav rail
- installed PWA launch opens `/mobile`
- visual review against `docs/plans/joy-pass-demo.html`: header gradient, paper background + grain, Fraunces/Manrope typography, button treatments, scene cards, eyebrow labels, focus ring colors
- `prefers-reduced-motion` disables pop/stamp/ring/page-transition motion without breaking layout
- ARIA live region announces auth state, connection state, and joy moments

Plan 6 will rely on this plan having a repeatable shell smoke path:

1. open `/mobile`
2. authenticate through the shared login flow
3. verify the signed-in account is visible
4. verify online/backend status is visible
5. verify only role-allowed mobile cards appear
6. verify no print actions appear
7. simulate offline/backend unavailable
8. verify desktop routes still use desktop layout

## Open Questions
- Decide whether the shared `/login` needs mobile-specific styling when reached from `/mobile`; recommendation: keep one route but make it responsive enough for phone login.
- Decide final PWA icon assets and whether they should reuse existing Hampton Hawks branding.
- Decide whether print routes remain outside the mobile shell entirely. Current decision: mobile has no print ability.
- Decide whether service worker support is needed at all. Recommendation: manifest-only first unless install behavior requires more.

## Approaches Considered
**Responsive Rewrite** would make existing desktop pages fully responsive. Rejected because the desktop site works well and should not be disturbed.

**Separate Mobile App** would create a second frontend. Rejected because shared auth, API clients, and Joy components are valuable, and a second app increases maintenance.

**Additive Mobile Routes** was selected because it keeps desktop stable while giving phone users purpose-built station workflows.

## Next Steps
- [ ] Turn this design into a Forge spec after the auth design.
- [ ] Define exact `/mobile/*` route names.
- [ ] Add PWA manifest/icon acceptance criteria.
- [ ] Add phone viewport visual review criteria against the Joy demo.
- [ ] Add install and online-only notes that feed the sale-day readiness plan.
