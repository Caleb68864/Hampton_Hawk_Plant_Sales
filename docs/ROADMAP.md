# Roadmap

Single list of open and done follow-ups. Sources: `docs/improve/2026-08-16-sweep-report.md`,
`docs/improve/2026-08-29-sweep-report.md`, `docs/sale-day/hardening-checklist.md`,
`docs/mobile-sale-day-readiness/`, `docs/findings/`. Keep this file current when an
item is started, finished, or dropped. Ordered by sale-day impact.

Last updated: 2026-11-21 (branch `test/e2e-imports-audit-followups`).

## Open

### Sale-day impact: high

- None open. (Lock order: done, see below.)

### Sale-day impact: medium

- **Pickup lookup still issues one orders request per matching customer**
  (`web/src/pages/pickup/PickupLookupPage.tsx`). Partly fixed in dc2e9f6: the input was
  already debounced (`SearchBar`, `pickupSearchDebounceMs`), so the cost was per
  settled search, not per keystroke. Superseded searches now stop fanning out, and at
  most 4 per-customer requests run at once. The remaining fix is one
  `ordersApi.list({search})` grouped client-side, which needs a product check on the
  phone/name/pickup-code matching rules first.
- **Login limiter 10/min and PIN lockout 30 failures/min, per client IP**
  (`api/src/HamptonHawksPlantSales.Api/Configuration/RateLimitPolicies.cs`,
  `Filters/AdminPinActionFilter.cs`). Since PR #77 the IP is the real client behind the
  proxy. Confirm before sale day that venue devices do not share one IP (e.g. a
  hotspot NAT between them and the server).

As of 2026-11-21 both items above wait on the owner (the matching-rule product
check; the venue network), as does everything below. `CLAUDE.md`'s CI paragraph
still names only `sale-day.spec.ts` and "5 logins"; it should also mention
`route-crawl.spec.ts` (6 logins), left for the owner since it is the agent
instruction file.

### Found by the 2026-11-21 audit, not yet fixed

- Pickup scan checks the order's status before its transaction; a concurrent bulk
  status change to Cancelled can still let one scan through (narrow window).
- Retry budget exhausted on session/register scans surfaces the raw Postgres error
  (500); `ExpandAsync` throws `NotImplementedException` (500) when its setting is on;
  check-constraint violations (23514) are not mapped to 400.
- Manual fulfil has no idempotency key.
- Revenue everywhere is quantity x the current catalog price, so changing a price
  after the sale rewrites past revenue (needs a price-at-sale column; product call).

### Product / policy calls

- Fulfillment event attribution: open questions left after `UserId`/`Source` landed.
  (1) Input method (camera vs. keyboard-wedge vs. typed SKU) would have to come from
  the client, and every scan page would need to send it; worth it only if the audit
  needs it, and it is client-asserted, not proof. (2) Sale-day accounts are per
  station, so `UserId` names the station login, not the volunteer; per-person
  attribution needs per-person logins or a "who is scanning" prompt. (3) Walk-up
  register sales (`WalkUpRegisterScans`), `InventoryAdjustments` and `AdminActions`
  carry no user either; extend the same `ICurrentUser` to them? (4) Show user/source
  in the order history UI (`FulfillmentEventResponse` returns them and the web
  `FulfillmentEvent` type declares them since `test/lock-order-gaps`; nothing renders
  them yet).

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
- Postgres tests run locally as of 2026-11-16 (`HH_POSTGRES_TESTS=1`, Docker reachable): 29 passed, 0 skipped.
  CI's `api-postgres` job still runs them on every push.
- No stale git worktrees for this repo were found on 2026-11-09 (`git worktree list`
  shows only the main checkout).

## Done

| item | where | commit |
|---|---|---|
| Web retry/timeout gaps. (1) Every scan page disabled its scan input while a scan was in flight, so the second of two quick scans (and its keystrokes) went nowhere. `ScanInput` takes `busy`: reads keep being taken, queue ("2 more scans waiting..."), and go to the server one at a time; register, pickup and pick-list pages use it. (2) The backend health check was a bare `fetch` with no timeout: a request lost when the Wi-Fi dropped never settled, no next check was scheduled, and the page never showed the backend as down; now aborted after 10 s like the axios client. (3) A pickup order or pick-list session that failed to load (network) said "Order not found" / "session not found" with no way back; it now says the load failed and offers Retry. (4) The label sheet printed short with no word when a requested plant failed to load; it now warns above the sheet (not printed). Tests fail on the old component/pages (the health-check one by mutation, the function was not exported before) | `ScanInput`, `WalkUpRegisterPage`, `PickupScanPage`, `PickupScanSessionPage`, `useBackendAvailability`, `PrintPlantLabelsPage` | `test/e2e-imports-audit-followups` |
| Register and pickup on a flaky network. (1) When the register could not reach the server to look up its open draft (reload during a Wi-Fi blip) it treated that as "the sale is gone" and opened a fresh draft, abandoning the one being rung up, whose units it had already taken off the shelf. Now it keeps the draft id, says so, and offers Retry. (2) After a multi-quantity scan got no answer the quantity snapped back to 1, so the rescan got a new scan id (keyed on barcode + quantity) and the server applied both; register and pickup now keep the quantity until the server answers. (3) A pickup scan that got no answer made no sound. (4) The pickup success flash subtracted the requested quantity from the pre-scan total; it now shows the server's `orderRemainingItems`. (5) A Close Sale retried after a timeout got 404 although the sale had closed; it now returns the closed sale, payment as first recorded. Page tests fail on the old pages, the close test on the old service | `WalkUpRegisterPage`, `PickupScanPage`, `WalkUpRegisterService.CloseDraftAsync` | `test/e2e-imports-audit-followups` |
| Preorder line edit/delete ran without locks while the line could be scanned. Lowering the ordered quantity read QtyFulfilled, a scan then raised it, and the save hit the fulfilled <= ordered check constraint (500). Deleting a line read "nothing fulfilled", a scan then fulfilled it, and the delete hid the line holding that stock (Undo could not find it). Both now run under the plant and line locks a scan takes (the walk-up path already did; the unlocked method is gone). `PreorderLineEditRaceTests` stages each with `Interleave`: on the old code the edit throws `DbUpdateException` (23514) and the delete leaves 9 on hand with the unit on a deleted line; on the new code the scan queues, then gets AlreadyFulfilled / WrongOrder | `OrderService.UpdateLineAsync`, `OrderService.DeleteLineAsync`, `PostgresTests/PreorderLineEditRaceTests.cs` | `test/e2e-imports-audit-followups` |
| Imports and report read-back in the browser E2E (left out of the route crawl). `.e2e/imports-reports.spec.ts` uploads plants (a quoted name with a comma, a `$4.50` price, one bad price), inventory and orders through the Imports page, checks the summaries, what was written, the history tab and its issue list, then sells some (a pickup scan, a cash register sale) and reads sales by plant/customer/seller, payment breakdown and daily sales back from the API and the pages. The browser runs in America/Chicago, so Daily Sales must list today's local date with today's sales. Against the web image from `21ea281` (before the report date fix) it fails there; against this branch, 8/8 green with the other two specs. CI's compose job now logs in 9 times of the limiter's 10/min | `.e2e/imports-reports.spec.ts`, `.github/workflows/ci.yml` | `test/e2e-imports-audit-followups` |
| Input validation that reached the database as 500s or bad rows. Line quantities were validated only on `POST /orders`: the walk-up add/update and single-line add routes saved 0 (an empty line) and let a negative through the availability check to the `QtyFulfilled <= QtyOrdered` check constraint (500). One rule now (`LineQuantity`, 1..10,000) on every route that sets a quantity, the ceiling also keeping quantity sums clear of `int` overflow (two lines of 1.5 billion summed negative and passed the walk-up check). Plant prices are held to the column, numeric(10,2): 100,000,000 overflowed (500) and 2.675 was rounded on save while the response echoed 2.675. Validator and service tests fail on the old code. The 10,000 ceiling is a sanity bound chosen by the agent, not a sale rule | `Core/Validators/LineQuantity.cs`, `CreateOrderValidator`, `Create/UpdatePlantValidator`, `WalkUpService`, `OrderService` | `test/e2e-imports-reports-bughunt` |
| Register sale integrity. (1) A register scan in flight while its draft was cancelled committed after the cancel: the cancel restored only the lines it had read, and the scan then took its stock on the deleted draft (units lost). (2) Close took no locks, so a scan in flight could add units to the Complete order after payment. The scan checked the draft's status before its transaction and never again. Now the scan locks the draft's order row after its plant/line locks and rechecks it is still a Draft; cancel reads its lines inside its transaction and locks the order row; close runs in a serializable transaction under the same lock. Three `Interleave` race tests (`RegisterDraftLifecycleRaceTests`), all failing on the old code (B's stock 4 not 5; 2 units on the order vs 1 paid; the queued scan succeeding); on the new code the late cancel/close hit 40001 and retry with the line included. (3) Close accepted negative tender, overflowing tender (numeric(12,2), a 500) and cash short of the total (closed as paid, "Change due $0.00"); now 400s, and the register page shows "short by" and disables Confirm Close. Payment methods are stored in one spelling (`cash` -> `Cash`). (4) The scan input stayed live behind the Close Sale dialog, so a barcode read there joined the sale after the total was shown; disabled while the dialog is open or closing, and a disabled `ScanInput` submits nothing. (5) `DELETE /api/orders/{id}` on a register draft holding stock left those units gone; refused with a pointer to Cancel Sale (empty drafts still delete) | `WalkUpRegisterService`, `OrderService.DeleteAsync`, `WalkUpRegisterPage`, `ScanInput`, `types/walkupRegister.ts`, `PostgresTests/RegisterDraftLifecycleRaceTests.cs` | `test/e2e-imports-reports-bughunt` |
| Scan integrity (found by a read-only audit, each confirmed in code). (1) The phone's camera refused every printed plant label: labels are the SKU zero-padded to 12 digits, which the page classed as an order number and answered "Wrong code type" without asking the server; it also sent the padded value, which the server cannot match. Now every read goes to the server through `toScanLookupValue` (as the desktop pages do) and the hint shows only when an order-shaped code comes back NotFound. (2) Pick-list session scans filled lines on Cancelled and Complete member orders (only Draft was excluded), oldest order first, so a cancelled order took the stock; the session total also counted cancelled lines and never reached 0. Now only Open/InProgress take stock. (3) Session scans had no idempotency key: a resent request fulfilled another unit, possibly on another member's order. `ScanInSessionRequest.ScanId` (retry-stable on the web, as for order scans), checked under the session lock; only the first event of a split scan carries it (unique `(OrderId, IdempotencyKey)`). (4) A pickup scan or manual fulfil on a soft-deleted order took stock (its lines are not deleted with it); now refused. (5) A scan on an order id that does not exist wrote an event that failed its FK and returned 500; now 404 before any write. Unit tests fail on the old code (service mutations for the session fixes, which change a signature); 3 new Postgres tests; web tests fail on the old page/hook | `MobilePickupScanPage`, `useScanWorkflow`, `ScanSessionService`, `FulfillmentService`, `ScanSessionDtos`, `PostgresTests/SessionScanIntegrityTests.cs` | `test/e2e-imports-reports-bughunt` |
| Report dates were UTC, so sale-day reports were wrong in US timezones. (1) The date pickers sent a bare `YYYY-MM-DD` that the API reads as an exclusive UTC-midnight `to`, so choosing today as the end date (Daily Sales' default) dropped every sale made today until ~6-7pm; now `reportsApi` sends local-day bounds with the end date inclusive (Daily Sales, Payment Breakdown, Walk-up vs Preorder). (2) Daily Sales bucketed by UTC date, so evening sales landed on tomorrow's row; it now takes the browser's `timeZone` (unknown or missing zone = UTC, as before). (3) Its date labels parsed the `DateOnly` as UTC and showed the day before. (4) Live KPI "orders/items today" reset at UTC midnight; it takes `timeZone` too. (5) A `to`/`from` bound bound as a Local `DateTime` was relabelled as UTC instead of converted. (6) CSV export filenames used the UTC date. Tests: web vitest (3 of 4 range/timezone cases fail on the old `reports.ts`), node tests pinned to America/Chicago (fail with the old formatters), API unit tests (timezone bucketing and the Local-kind bound fail with the old lines restored; the live KPI test shows UTC vs venue day) | `web/src/utils/reportDateRange.ts`, `web/src/api/reports.ts`, `web/src/pages/reports/*`, `ReportService`, `ReportsController` | `test/e2e-imports-reports-bughunt` |
| Route crawl rebuilt (the 08-29 harness swept all routes but was never tracked). `.e2e/route-crawl.spec.ts` seeds a plant, seller, customer, order, register draft and scan session, then opens all 59 routes in `web/src/App.tsx` (admin, print, mobile) as the admin and fails on an uncaught page error, a 5xx from `/api`, the 404 page, or ending on another path (e.g. bounced to `/login`). A second test parses App.tsx and fails when a route has no crawl entry or an entry has no route. One login, so CI's compose job is at 8 of the limiter's 10/min. Found no bugs: 7/7 green locally against images built from `03f578a` (crawl then sale-day, same DB, as CI orders them). Mutation proof: an injected 500 on `/api/sellers/*`, a thrown error on `/settings`, a bad `/docs` URL and cleared cookies before `/mobile/account` were each reported; deleting the `docs` entry failed the App.tsx check. Not covered: imports and report read-back from the 08-29 run | `.e2e/route-crawl.spec.ts`, `.github/workflows/ci.yml` | `test/e2e-route-crawl` |
| Wire `.e2e/` into CI. Done in PR #83 (`03f578a`): the `compose` job runs the Playwright specs against `docker compose up`; green on main, run 43922198101 (2026-11-16, "5 passed") | `.github/workflows/ci.yml`, `.e2e/` | PR #83 |
| Every refused register scan (over walk-up availability, out of stock, unknown barcode) logged an EF Core Error, "An error occurred using a transaction" (found by the browser E2E run). Cause: the refusal branch called `RollbackQuietlyAsync` and threw, then the catch-all called it again on the completed transaction; Npgsql rejects the second rollback, EF logs that at Error under `Microsoft.EntityFrameworkCore.Database.Transaction`, and only the exception was swallowed. `RollbackQuietlyAsync` now skips a transaction that is already complete (`DbTransaction.Connection == null`), so it fixes every caller (register, scan sessions, fulfillment, orders, inventory). Real failures still log: no EF category is filtered. Log-capturing Postgres tests; the refusal test fails on the old code, two controls prove Error logs still surface | `WalkUpRowLocks.RollbackQuietlyAsync`, `PostgresTests/RefusedScanLoggingTests.cs` | `fix/refused-scan-log-noise` |
| Race tests for the two lock-order changes that had none, in `LockOrderRaceTests`. Walk-up line move: two moves on one walk-up order swapping lines between plants A and B, run through both routes (`WalkUpService.UpdateWalkUpLineAsync`, `OrderService.UpdateLineAsync`; new `[PostgresTheory]`), held before the line write. Cancel-draft: two drafts that rang up A and B in opposite orders, the first cancel held before its second plant lock. Reverting each (lock only the new plant; drop the plant-id sort) gives 40P01 in all three cases (retried, so the callers still succeed), restored code none. Found on the way: `UpdateWalkUpLineAsync` threw `NullReferenceException` after committing whenever the line moved to a plant not tracked by the context (every real request: EF nulls the navigation on save), so `PUT /api/walkup/orders/{id}/lines/{lineId}` with a new plant would return 500 although the move was saved (reasoned from the service; not exercised over HTTP); fixed with a null-safe check, unit test fails without it. Web `FulfillmentEvent` type now declares `userId` and `source` (no UI) | `PostgresTests/LockOrderRaceTests.cs`, `PostgresTests/Infrastructure/Interceptors.cs`, `PostgresTests/Infrastructure/PostgresFactAttribute.cs`, `WalkUpService`, `Tests/Services/WalkUpServiceTests.cs`, `web/src/types/fulfillment.ts` | `test/lock-order-gaps` |
| Fulfillment events carry `UserId` (signed-in account, from the cookie's NameIdentifier via new `ICurrentUser`/`HttpCurrentUser`) and `Source` (`PickupScan`/`SessionScan`/`ManualFulfill`/`Undo`, set by the server). Nullable columns, migration `AddFulfillmentEventAttribution`, no FK so the row outlives the account. Returned on `GET .../events`. Unit tests fail with the stamping removed (4 of 5; the fifth tests `HttpCurrentUser` alone). Audit guide SQL corrected to the real PascalCase table names. Open questions under "Product / policy calls" | `Core/Models/FulfillmentEvent.cs`, `Core/Interfaces/ICurrentUser.cs`, `Api/Configuration/HttpCurrentUser.cs`, `FulfillmentService`, `ScanSessionService`, `Tests/Services/FulfillmentEventAttributionTests.cs`, `docs/mobile-sale-day-readiness/07-audit-troubleshooting.md` | `fix/canonical-lock-order` |
| One canonical lock order across the stock write paths (pickup scan, manual fulfil, undo, session scan, register scan/adjust/void/cancel, `WalkUpRowLocks` callers in `WalkUpService`/`OrderService`, inventory adjust/set, bulk order status). Order and rationale on `WalkUpRowLocks`: ScanSessions, then per plant (ascending id) PlantCatalogs -> Inventories -> OrderLines, then Orders, then FulfillmentEvents. The plant lock comes first even where the plant is not written, because event/adjustment/line inserts take `FOR KEY SHARE` on it. Seven `Interleave.RunAsync` tests (`LockOrderRaceTests`), one per formerly inverted pair (manual fulfil/scan, scan/register, session scan/scan, register adjust/scan, stock adjust/register, undo/walk-up add, bulk status/bulk status); all seven saw 40P01 on the old code (on the bulk pair it reached the caller as a raw `PostgresException`, there is no retry) and none on the new. 40001 still occurs under SERIALIZABLE and is retried. The two ordering-only changes (walk-up line move, register cancel-draft) got their race tests in `test/lock-order-gaps` (row below) | `Data/WalkUpRowLocks.cs`, `FulfillmentService`, `ScanSessionService`, `WalkUpRegisterService`, `InventoryService`, `OrderService`, `WalkUpService`, `PostgresTests/LockOrderRaceTests.cs` | `fix/canonical-lock-order` |
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
