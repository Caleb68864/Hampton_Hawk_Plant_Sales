# Roadmap

Single list of open and done follow-ups. Sources: `docs/improve/2026-08-16-sweep-report.md`,
`docs/improve/2026-08-29-sweep-report.md`, `docs/sale-day/hardening-checklist.md`,
`docs/mobile-sale-day-readiness/`, `docs/findings/`. Keep this file current when an
item is started, finished, or dropped. Ordered by sale-day impact.

Last updated: 2026-11-16 (branch `fix/sale-day-register`).

## Open

### Sale-day impact: high

- **Lock order is inconsistent across services** (scan: Inventories->OrderLines; manual
  fulfil / register adjust: OrderLines->Inventories; session scan:
  ScanSessions->OrderLines->Inventories; `WalkUpRowLocks`: Plant->Inventory->OrderLine).
  Retry wrappers turn the resulting 40P01 into a retry, not a 500. The proper fix is one
  canonical order across all seven paths, with an `Interleave.RunAsync` race test in
  `api/tests/HamptonHawksPlantSales.PostgresTests`.

### Sale-day impact: medium

- **Pickup lookup still issues one orders request per matching customer**
  (`web/src/pages/pickup/PickupLookupPage.tsx`). Partly fixed in dc2e9f6: the input was
  already debounced (`SearchBar`, `pickupSearchDebounceMs`), so the cost was per
  settled search, not per keystroke. Superseded searches now stop fanning out, and at
  most 4 per-customer requests run at once. The remaining fix is one
  `ordersApi.list({search})` grouped client-side, which needs a product check on the
  phone/name/pickup-code matching rules first.
- **Wire `.e2e/` into the repo and CI.** The Playwright spec described in the 08-29
  report is still untracked (`.git/info/exclude`) and is not in this checkout.
- **Login limiter 10/min and PIN lockout 30 failures/min, per client IP**
  (`api/src/HamptonHawksPlantSales.Api/Configuration/RateLimitPolicies.cs`,
  `Filters/AdminPinActionFilter.cs`). Since PR #77 the IP is the real client behind the
  proxy. Confirm before sale day that venue devices do not share one IP (e.g. a
  hotspot NAT between them and the server).
- **Fulfillment events carry no `UserId` / `Source`** (hardening-checklist BACKLOG:P1,
  `docs/mobile-sale-day-readiness/07-audit-troubleshooting.md`). Post-sale audit has to
  cross-reference the paper volunteer sheet.

### Product / policy calls

- Customer/seller mutation is open to every LookupCapable role; single deletes need no
  PIN while bulk deletes do.
- Order status hygiene: `UpdateAsync`/`BulkSetStatus` accept any target status incl.
  Draft; `ResetOrderAsync` only flips Complete->InProgress; `BarcodeLockedAt` unenforced
  in `PlantService.UpdateAsync`.
- `ExceptionHandlerMiddleware` echoes raw exception text on 500s (kept for
  `errorMessaging.ts` volunteer guidance).
- `live-sale-kpi` is `[AllowAnonymous]` (projector) and publishes totals.
- Import history / issue lists capped at 100 / 200 with no paging; imports buffer the
  whole upload.
- Soft-deleting a customer/seller/plant drops its orders from per-entity reports but not
  from totals.

### Cosmetic

- REQ-021 demo page role gate is Admin-only vs spec's Pickup+Admin
  (`docs/findings/verification-2026-05-12-camera-scanner-foundation.md`); accept or change.

### Environment notes (not code)

- This machine has only .NET 10 runtimes; the net9.0 test hosts need
  `DOTNET_ROLL_FORWARD=Major dotnet test ...` to run here.
- Postgres tests run locally as of 2026-11-16 (`HH_POSTGRES_TESTS=1`, Docker reachable): 16 passed, 0 skipped.
  CI's `api-postgres` job still runs them on every push.
- No stale git worktrees for this repo were found on 2026-11-09 (`git worktree list`
  shows only the main checkout).

## Done

| item | where | commit |
|---|---|---|
| Register "Manager Override" could never succeed: it matched the barcode against `plantSku`/`plantName` and fell back to a plain scan the server refused again. The register scan now takes an optional `X-Admin-Pin`/`X-Admin-Reason` (same `TryAdminOverride` as AdjustLine), skips only the availability check, still stops at on-hand, and logs `WalkUpRegisterScanOverride`. The page re-sends the refused scan at the requested quantity with a fresh scan id. Unit, page and Postgres tests; the service and page tests fail on the old code | `WalkUpRegisterService.ScanIntoDraftAsync`, `WalkUpRegisterController.Scan`, `web/src/pages/walkup/WalkUpRegisterPage.tsx`, `web/src/api/walkupRegister.ts` | `fix/sale-day-register` |
| Register scan idempotency kept only the last scanId per line, so a late retry of an older scan re-applied. New `WalkUpRegisterScans` table, unique `(OrderId, ScanId)`, migration `AddWalkUpRegisterScans`; the line's key is still checked for drafts opened before the migration. `DeleteAllOrdersAsync` clears the new table (its Restrict FK would otherwise 23503 the wipe; proved by mutation against Postgres) | `WalkUpRegisterService`, `Core/Models/WalkUpRegisterScan.cs`, `OrderService.DeleteAllOrdersAsync` | `fix/sale-day-register` |
| `ScanInput` silently dropped the second of two identical plants scanned within 2 s. Window narrowed to 400 ms (hardware double-read only) and a status line now says when a read is dropped; optional `onDuplicateIgnored` prop | `web/src/components/pickup/ScanInput.tsx`, `__tests__/ScanInput.test.tsx` | b73e61c |
| Mobile order lookup logged the customer's pickup code to `console.debug` despite its comment (hardening-checklist item 8, REGRESSION:LOW). Now logs `codeLength`; the test that pinned the leak now pins the redaction | `web/src/pages/mobile/MobileOrderLookupPage.tsx`, `__tests__/MobileOrderLookupPage.test.tsx` | f16edc9, a7b58f3 |
| A superseded pickup lookup kept firing its per-customer order requests (up to 50 at once). It now stops once superseded and caps concurrency at 4. Two new tests, both failing on the old page | `web/src/pages/pickup/PickupLookupPage.tsx`, `__tests__/PickupLookupPage.test.tsx` | dc2e9f6 |
| Mobile scan page rendered the previous "Accepted" message beside a new recoverable/error message: polite region (4 s TTL) and assertive region both held text. A new announcement now clears the other region. Verified from code and a unit test, not re-checked on a device | `web/src/components/mobile/joy/JoyAriaLive.tsx`, `__tests__/JoyAriaLive.test.tsx` | ff4aaeb |
| Web `FulfillmentResultType` lacked the API's `Undone` | `web/src/types/fulfillment.ts`, `ScanHistoryList.tsx`, `ScanFeedbackBanner.tsx` | 6ca0874 |
| Hardening-checklist TODO: `MobilePickupLookupPage` 401 handling. Verified: redirects to `/login` via `isSessionExpired` | `web/src/pages/mobile/MobilePickupLookupPage.tsx` | (verified, no change) |
| Postgres-backed integration tests (Testcontainers) | `api/tests/HamptonHawksPlantSales.PostgresTests`, CI `api-postgres` | PR #67 |
| CI compose job (`docker compose up --build` probed) | `.github/workflows/ci.yml` | PR #67 |
| Secure cookie on a plain-HTTP LAN fallback / forwarded headers | API auth + `UseForwardedHeaders` | PR #75, #77 |
| `PickupScanSessionPage.handleEndSession` navigated before a failed close could show its error | 08-29 audit fixes | 82be6bc |
| Lint hygiene and single `npm test` entry point (08-16 queue items 4 and 6) | `web/scripts/run-node-tests.mjs` | a578fb4, 2a3e542 |
| Everything else in the 08-29 "Completed" and "Audit fixes" tables | see that report | |
