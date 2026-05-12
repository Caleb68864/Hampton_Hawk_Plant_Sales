# Hardening Verification Log

**Date:** 2026-05-12
**Branch:** `2026/05/12-1534-caleb-feat-mobile-sale-day-readiness-and-hardening`
**Verifier:** Automated factory pass (SS-03)

---

## REQ-014 — No Print Imports in Mobile UI

**Command run:**

```
grep -RIn "print" web/src/pages/mobile web/src/layouts/MobileLayout.tsx web/src/components/mobile
```

**Result:** ✅ PASS — command returned no output. No Print button, no `window.print` call, and no `routes/print` import found anywhere under the mobile UI tree.

---

## REQ-013 — Service Worker Does Not Cache API Data

**Files inspected:**
- `web/public/service-worker.js`
- `web/src/pwa/registerServiceWorker.ts`

**Findings:**

A service worker exists at `web/public/service-worker.js` and is registered by `web/src/pwa/registerServiceWorker.ts` (scope: `/`).

The worker defines a `BYPASS_PATTERNS` array that explicitly excludes the following path prefixes from caching or interception:

```js
const BYPASS_PATTERNS = [
  /^\/api\//,
  /^\/auth\//,
  /^\/login/,
  /^\/logout/,
  /\/scan/,
  /\/order/,
  /\/fulfillment/,
  /\/report/,
  /\/users/,
  /\/user-management/,
  /\/media\//,
  /\/camera/,
  /\/health/,
];
```

The `fetch` handler returns early (falls through to browser/network default) for any request matching a bypass pattern:

```js
if (shouldBypass(event.request.url)) {
  return; // falls through to browser default (network)
}
```

`/api/*` is the first pattern and is matched before any cache logic runs.

The cache (`hawk-shell-v1`) is pre-populated at install time with only shell assets: `/`, `/mobile`, `/manifest.webmanifest`, `/pwa-192.png`, `/pwa-512.png`. No API endpoints are cached.

**Result:** ✅ PASS — `/api/*` and all operational endpoints are unconditionally bypassed by the service worker. Live scan, order, and fulfillment calls always go to the network.

---

## REQ-012 / REQ-020 — App-Switch, Lock, Visibility, Route Recovery (BEHAVIORAL)

**Status:** ⚠️ BLOCKED — requires a physical device or device emulator with the mobile scan workflow (SS-03 / SS-04 / SS-05) merged and running. This verification cannot be automated in the factory context.

**Scenarios to verify manually on a real phone:**

| Scenario | Steps | Expected | Actual |
|---|---|---|---|
| App switch mid-scan | Open scanner, switch to another app, return | Scanner re-activates, no stale state | _Pending_ |
| Phone lock during scan session | Open scanner, lock device, unlock | Session resumes normally | _Pending_ |
| Tab/window visibility change | Switch browser tab, return | No JS errors, camera resumes | _Pending_ |
| Route change (back/forward) | Navigate away from scan page, navigate back | Scanner reinitializes cleanly | _Pending_ |

**Tracking issue:** `docs/backlog/BACKLOG-001-behavioral-device-verification.md`

---

## REQ-015 — Offline / Wi-Fi Off Scene (BEHAVIORAL)

**Status:** ⚠️ BLOCKED — requires a physical phone. Wi-Fi must be disabled at the OS level; browser DevTools offline mode does not fully replicate the mobile network-loss path.

**Scenario to verify:**

1. Load `/mobile` on a phone with app installed to home screen.
2. Disable Wi-Fi.
3. Confirm the UI shows a connection-required / backend-unavailable message (not a blank screen or JS crash).
4. Re-enable Wi-Fi and confirm the app recovers without a full reload.

**Screenshot path (to be filled in during live verification):** `docs/mobile-sale-day-readiness/screenshots/REQ-015-wifi-off.png`

**Tracking issue:** `docs/backlog/BACKLOG-002-offline-scene-screenshot.md`

---

## Failed / Deferred Checks Summary

| Check | Req | Status | Backlog Ref |
|---|---|---|---|
| Behavioral: app-switch / lock / visibility / route recovery | REQ-012, REQ-020 | Blocked on real device | BACKLOG-001 |
| Behavioral: offline Wi-Fi-off scene + screenshot | REQ-015 | Blocked on real device | BACKLOG-002 |
| Per-scan actor/source attribution in `fulfillment_events` | REQ-008 (partial) | Current model lacks `VolunteerId` / `ScanSource`; audit by device assignment only | BACKLOG-003 |

All other checks passed at the time of this verification run.
