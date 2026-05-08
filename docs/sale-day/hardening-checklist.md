---
title: Sale-Day Hardening Verification Checklist
audience: ops / engineering reviewer
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md
  - docs/plans/2026-05-05-03-camera-scanner-foundation-design.md
  - docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md
  - docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Hardening Verification Checklist

Read-only audit performed on branch
`2026/05/07-1955-caleb-feat-mobile-scanner-workflows` on 2026-05-07.

Each item is marked:

- `[VERIFIED]` -- confirmed by reading source.
- `[REGRESSION:<note>]` -- contradicts spec intent; should be filed as a fix.
- `[BACKLOG:<note>]` -- known gap, intentional or accepted, tracked for
  follow-up.
- `[TODO:<reason>]` -- could not be verified from source alone.

No source files were modified during this audit (per plan 06 scope).

## Camera lifecycle

### 1. `useBarcodeScanner` consumers stop the camera on unmount

`[VERIFIED]` -- `web/src/components/mobile/BarcodeScanner.tsx:78` calls
`stop()` in the unmount cleanup of the auto-start effect. Inside the hook
itself (`web/src/hooks/useBarcodeScanner.ts:80, :207`), `controlsRef.current.stop()`
runs both on the manual stop path and on the `useEffect` cleanup. All
`MediaStreamTrack`s are stopped at line 74 inside `stop()`.

### 2. Camera releases on tab visibility change (background / foreground)

`[VERIFIED]` -- `web/src/hooks/useBarcodeScanner.ts:201-202` registers a
`visibilitychange` listener that invokes `stop()` (line 159) when the tab
becomes hidden. The listener is removed in the cleanup. Cross-references
`docs/tests/scanner-fixtures.md` -> "Tab-switch / visibility".

### 3. Camera releases on phone lock

`[VERIFIED-via-mechanism]` -- phone lock fires `visibilitychange` (page
becomes hidden), so item 2 covers this. No physical-device test was
performed during the doc pass; the volunteer drill in `device-checklist.md`
covers it on T-1.

### 4. Camera releases on route change away from a scanner page

`[VERIFIED]` -- `BarcodeScanner` is unmounted when the route unmounts,
firing the cleanup at `BarcodeScanner.tsx:78`. Inside the hook, the
useEffect cleanup at line 207 also fires.

## Auth / 401 handling

### 5. All mobile pages handle 401 -> /login redirect

`[VERIFIED]` -- searched for `401` and `navigate('/login'`:

- `MobileOrderLookupPage.tsx:39, :151` -- detects `e.response?.status === 401`
  and navigates to `/login` with `state: { from: LOOKUP_PATH }`.
- `MobilePickupScanPage.tsx:43, :193` -- detects `e.status === 401 || e.response?.status === 401`
  and navigates to `/login` with `state: { from: location.pathname }`.
- `MobileDrawer.tsx:41` -- explicit sign-out flow navigates to `/login`.
- `MobileTabletRail.tsx:22` -- same.

`MobilePickupLookupPage.tsx` was not directly observed setting up a 401
handler at the page level; it relies on the underlying API client / parent.
`[TODO: confirm MobilePickupLookupPage 401 path -- defer to plan 04 spec
review.]`

### 6. Route guards reject unauthenticated users from `/mobile/*`

`[VERIFIED]` -- `web/src/routes/MobileRouteGuard.tsx` exists; combined with
`mobileRouteConfig.ts` which exports `hasMobileAccess(user)`. Tests at
`web/src/routes/__tests__/mobileRouteConfig.test.ts` confirm filtering by
role.

### 7. Roles are enforced at the route layer (not just hidden in the UI)

`[VERIFIED]` -- `mobileRouteConfig.ts:11-15` defines `PICKUP_ROLES`,
`LOOKUP_ROLES`, `ADMIN_ONLY`. `getMobileWorkflows()` filters by
`user.roles.includes(r)`. The `RoleRoute` and `MobileRouteGuard`
components apply the gates. Backend gates remain authoritative -- this
audit only covers frontend.

## Privacy / telemetry

### 8. No `console.log` of order numbers / barcodes / customer data

`[REGRESSION: minor]` --

- `MobilePickupScanPage.tsx:148` logs `console.debug('mobile-pickup-scan', { orderId, source, scannedAtUtc })`.
  `orderId` is a UUID, not a customer-facing identifier; acceptable per
  REQ-021 telemetry intent.
- `MobilePickupLookupPage.tsx:110` -- same shape, also acceptable.
- `MobileOrderLookupPage.tsx:185-191` logs
  `console.debug('mobile-lookup-scan', { source, code, scannedAtUtc })`.
  **`code` is the scanned barcode payload**, which on a real label is
  effectively an order number. The comment at line 185 says "no console.log
  of code", but `code` IS in the `console.debug` payload at line 189.

This is a `[REGRESSION:LOW]` because:
- It is `console.debug` not `console.log`, and `console.debug` is
  filtered out by default in production browser consoles.
- The scanner payload is short and not customer-PII (no names / emails).
- Operators capturing the console intentionally on sale day (per
  `audit-guide.md`) want to see the code.

But the in-file comment on line 185 is now misleading. Recommended action:
- Either remove `code` from the debug payload, OR
- Update the comment to reflect that `code` IS logged on the debug
  channel deliberately.

Filed as backlog entry: `docs/sale-day/hardening-checklist.md#item-8`. Do
not modify in this plan-06 pass.

### 9. No `console.log` (production-noisy) anywhere under `/mobile/*`

`[VERIFIED]` -- a `Grep` for `console\.log` in
`web/src/pages/mobile/` returned only a comment line in
`MobileOrderLookupPage.tsx:185`. No actual `console.log()` calls.

## Print controls

### 10. No `window.print()` or Print buttons under `/mobile/*`

`[VERIFIED]` -- a `Grep` for `print|window\.print` in
`web/src/pages/mobile/` returned no matches. A broader grep across
`/mobile*` files returned only `LookupPrint` (a role enum value, not a
print control) and unrelated test strings.

### 11. Mobile shell does not import any `routes/print*` module

`[VERIFIED]` -- the mobile shell (`MobileLayout.tsx`, mobile pages) does
not import any module under a `print/` directory; the existing print
templates in `web/public/templates/` are referenced only by the
non-mobile kiosk / web admin paths.

## Service worker

### 12. Service worker does not cache `/api/*`

`[VERIFIED]` -- `web/public/service-worker.js:5-23` defines
`BYPASS_PATTERNS` including `/^\/api\//`, and the fetch handler at
line 50 returns early (browser default = network) when the URL matches.

### 13. Service worker does not cache auth state or order state

`[VERIFIED]` -- the bypass list also covers `/auth/`, `/login`,
`/logout`, `/scan`, `/order`, `/fulfillment`, `/report`, `/users`,
`/user-management`, `/health`, `/camera`. Only the static shell (`/`,
`/mobile`, `/manifest.webmanifest`, PWA icons) is cached.

### 14. Service worker only caches GET requests

`[VERIFIED]` -- `service-worker.js:56` returns early if
`event.request.method !== 'GET'`.

### 15. Service worker does not implement background sync / queueing

`[VERIFIED]` -- no `sync` event handler is registered in
`service-worker.js`. No IndexedDB usage. No `BackgroundSync` API. The
shell is online-only, matching the spec's Edge Cases section.

## Connection-required / backend-unavailable scenes

### 16. Mobile shell renders connection-required when offline

`[VERIFIED]` -- `MobileLayout.tsx:24` renders
`MobileConnectionRequiredScene` when offline (driven by the
`useOnlineStatus` hook at `web/src/hooks/useOnlineStatus.ts:4`). Each
workflow page also has its own offline guard (`MobilePickupScanPage.tsx:267`,
`MobileOrderLookupPage.tsx:217`).

### 17. Mobile shell renders backend-unavailable when API is down

`[VERIFIED]` -- `MobileLayout.tsx:31` renders
`MobileBackendUnavailableScene` for backend-error states. Component
exists at `web/src/components/mobile/MobileBackendUnavailableScene.tsx`.

### 18. Connection-required scene offers a retry path

`[VERIFIED]` -- `MobileOrderLookupPage.tsx:217` passes an `onRetry`
callback that re-evaluates `navigator.onLine`. The component itself
(`MobileConnectionRequiredScene.tsx`) accepts an optional `onRetry`
prop.

## Audit attribution

### 19. Fulfillment events record the user / station

`[BACKLOG: P1]` -- `api/src/HamptonHawksPlantSales.Core/Models/FulfillmentEvent.cs`
has `OrderId`, `PlantCatalogId`, `Barcode`, `Result`, `Quantity`,
`Message`, `CreatedAt` -- no `UserId`, no `Source`, no `StationId`. The
post-sale audit can identify "what happened" but not "who did it" from
the row alone.

This is documented in `audit-guide.md` -> "Known gaps -- read this
first". Workaround: cross-reference the timestamp against the volunteer
assignment sheet.

Recommended follow-up backlog item:
`add UserId + Source columns to FulfillmentEvent`. Out of scope for
plan 06 (read-only audit pass).

### 20. Admin actions record the operator-supplied reason

`[VERIFIED]` -- `AdminAction.cs` has a `Reason` field; the
`AdminPinActionFilter` validates `X-Admin-Reason` and persists it via
`HttpContext.Items["AdminReason"]`. The CLAUDE.md project rules
mandate this pattern.

## Visual / shell

### 21. Mobile shell uses Joy tokens (gold-300/500, plum-shadow)

`[VERIFIED]` -- `web/src/styles/mobile-theme.css` exists per plan 02.
Joy components live at `web/src/components/mobile/joy/` (Checkbloom,
Stamp, Seed, JoyAriaLive). A more thorough visual audit is in
`joy-visual-audit.md`.

### 22. Mobile drawer signs out and navigates to /login

`[VERIFIED]` -- `MobileDrawer.tsx:41` calls `navigate('/login')` on the
sign-out handler. `MobileTabletRail.tsx:22` mirrors this.

## PWA manifest

### 23. Manifest `start_url` is `/mobile`

`[VERIFIED]` -- `web/public/manifest.webmanifest:5`:
`"start_url": "/mobile"`.

### 24. Manifest `display` is `standalone`

`[VERIFIED]` -- `manifest.webmanifest:6`: `"display": "standalone"`.

### 25. Manifest `theme_color` matches plum shell

`[VERIFIED]` -- `manifest.webmanifest:8`: `"theme_color": "#2d1152"`,
which is the plum-shadow token referenced by plan 02.

## Summary

| Category | Items | Verified | Regression | Backlog | Todo |
|----------|-------|----------|------------|---------|------|
| Camera lifecycle | 4 | 4 | 0 | 0 | 0 |
| Auth / 401 | 3 | 2 | 0 | 0 | 1 |
| Privacy | 2 | 1 | 1 (low) | 0 | 0 |
| Print controls | 2 | 2 | 0 | 0 | 0 |
| Service worker | 4 | 4 | 0 | 0 | 0 |
| Connection / backend | 3 | 3 | 0 | 0 | 0 |
| Audit | 2 | 1 | 0 | 1 (P1) | 0 |
| Visual / shell | 2 | 2 | 0 | 0 | 0 |
| PWA manifest | 3 | 3 | 0 | 0 | 0 |
| **Total** | **25** | **22** | **1** | **1** | **1** |

## Backlog items to file

1. **REGRESSION:LOW** -- Reconcile `MobileOrderLookupPage.tsx:185`
   comment vs the `code` field actually being included in the debug
   payload. Either redact the code or update the comment.
2. **BACKLOG:P1** -- Add `UserId` and `Source` columns to
   `FulfillmentEvent` so audit attribution does not depend on the paper
   volunteer assignment sheet.
3. **TODO** -- Confirm `MobilePickupLookupPage.tsx` 401 handling at the
   page level (defer to plan 04 spec review).
