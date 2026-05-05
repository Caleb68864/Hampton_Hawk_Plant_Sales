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

**Joy mobile styling** reuses the Hampton Hawks purple/gold palette, Fraunces/Manrope typography, tactile buttons, warm paper-like surfaces, and scan feedback patterns already established by `docs/plans/joy-pass-demo.html`.

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
- wrong-role `/mobile` shows mobile unavailable/access-denied state
- offline browser state blocks mobile workflows
- backend unavailable state is visible
- manifest exists and points to `/mobile`
- no print controls render in the mobile shell
- 375px and 430px viewport checks
- installed PWA launch opens `/mobile`

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
