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

- `/mobile/login` or shared `/login`
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

## Error Handling
- Offline state shows a clear connection-required message.
- Backend unavailable shows retry messaging and does not allow local scan completion.
- Wrong-role users see a mobile access-denied page with account identity visible.
- Expired sessions redirect to login.
- Mobile layout must keep touch controls large enough for one-hand use.
- Text must fit without overlap on common phone widths.

## Open Questions
- Decide whether login is a shared `/login` route or a mobile-styled `/mobile/login` using the same auth API.
- Decide final PWA icon assets and whether they should reuse existing Hampton Hawks branding.
- Decide whether print routes remain outside the mobile shell entirely. Current decision: mobile has no print ability.

## Approaches Considered
**Responsive Rewrite** would make existing desktop pages fully responsive. Rejected because the desktop site works well and should not be disturbed.

**Separate Mobile App** would create a second frontend. Rejected because shared auth, API clients, and Joy components are valuable, and a second app increases maintenance.

**Additive Mobile Routes** was selected because it keeps desktop stable while giving phone users purpose-built station workflows.

## Next Steps
- [ ] Turn this design into a Forge spec after the auth design.
- [ ] Define exact `/mobile/*` route names.
- [ ] Add PWA manifest/icon acceptance criteria.
- [ ] Add phone viewport visual review criteria against the Joy demo.
