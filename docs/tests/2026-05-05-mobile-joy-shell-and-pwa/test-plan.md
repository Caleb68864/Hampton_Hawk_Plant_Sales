# Test Plan -- Mobile Joy Shell and PWA

This is the smoke path used by the sale-day readiness plan to confirm the mobile shell is healthy on a phone before staff devices are handed out. Run end-to-end against the deployed stack.

## Pre-conditions

- API container running and reachable (`/api/health` returns 2xx).
- Web bundle built (`cd web && npm run build`).
- At least one user per role available: `Admin`, `Pickup`, `LookupPrint`, `POS`.

## Smoke path (run on a phone or 375px DevTools viewport)

1. **Open `/mobile` unauthenticated** -- the app routes through the shared `/login` rendered on the paper background with the mobile primary button. Sign in successfully and confirm return to `/mobile`.
2. **Account visible** -- the top app bar shows the signed-in account label.
3. **Connection visible** -- the connection status dot is rendered in the top bar in its `online` state.
4. **Role-allowed cards** -- the home page shows the quick-action cards permitted by the current role:
   - `Admin` and `Pickup` -- pickup card visible.
   - `Admin`, `Pickup`, `LookupPrint` -- lookup card visible.
   - `POS`-only -- access-denied scene replaces the layout body; no drawer rendered.
5. **No print controls** -- inspect `MobileLayout` and `MobileHomePage`; no `print`, `Print`, or printer-icon controls anywhere in the rendered tree.
6. **Simulate offline** -- DevTools > Network > Offline (or `navigator.onLine = false`) -- confirm `MobileConnectionRequiredScene` renders and the workflow cards are removed. Toggle back online -- confirm home returns without a manual reload.
7. **Simulate backend down** -- stop the API container while keeping the browser online -- confirm `MobileBackendUnavailableScene` renders with a working retry; restart the API and confirm home returns.
8. **Desktop unaffected** -- on the same browser, visit `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, and the kiosk routes. Each renders through the existing desktop / kiosk layout. No mobile-only styling leaks through.

## Tablet checks (768px and 1024px)

9. **Layout swap** -- top bar height grows to 56px; permanent left rail (~220px) is rendered; hamburger button is hidden. `MobileHomePage` becomes a two-column grid.

## Accessibility checks

10. **Reduced motion** -- DevTools > Rendering > `prefers-reduced-motion: reduce` -- confirm `Checkbloom`, `Stamp`, `Seed`, page transitions, and the qa-card press bar render statically without breaking layout.
11. **ARIA live** -- DevTools accessibility tree shows two `aria-live` regions (polite + assertive) at the layout level. Trigger an online/offline toggle and confirm the polite region announces "Connection restored" / "You are offline".

## PWA install

12. **Add to home screen** -- on a supported phone or browser, install the PWA. Launch from the home-screen icon and confirm the URL is `/mobile`.

## Sign-off

Reviewer (spec author / sale-day owner) records pass / fail per item with screenshots in `docs/tests/2026-05-05-mobile-joy-shell-and-pwa/viewport-checks.md`.
