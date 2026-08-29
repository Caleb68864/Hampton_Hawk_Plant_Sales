# Improve Report — Hampton Hawks Plant Sales — sweep + end-to-end — 2026-08-29

## Summary

Second hardening sweep on `2026/08/12-0915-caleb-fix-sale-day-hardening`, this
time followed by a real browser end-to-end run against Postgres 16 (the unit
suites use the EF in-memory provider, which enforces neither unique indexes nor
FKs). The E2E run found four sale-day-blocking defects the 440-test suite could
not see, the worst being that **no new customer or seller could be created after
the first one** on any database migrated past `AddPicklistBarcodes`.

Then a five-auditor read-only pass (59 findings) whose confirmed, autonomous-
class items were fixed by three worktree workers, and a final E2E run over the
merged result.

Local commits this sweep: 61 on top of `544bb4e` (18 sweep/E2E, 43 audit
fixes, 2 merges). Not pushed.

Final validation: API 523 pass / 0 fail / 2 skip (was 438 / 0 / 2), build 0
warnings (was 5); web `tsc -b` clean; `npm test` = node:test 119/119 + vitest
209/209 (was 43/43 with 11 files never run, and vitest 139/5); `npm run lint`
0 problems (was 27 errors / 5 warnings); browser E2E 8/8 flows green on a
production bundle against Postgres.

## Baseline

| check | result |
|---|---|
| API build | OK, 5 CS1573 warnings (`ImportController`) |
| API tests | 438 pass / 0 fail / 2 skip |
| web `tsc -b` | OK |
| web `npm test` (node:test, 10 hand-listed files) | 43 / 43 — 11 more node:test files existed but ran nowhere |
| web vitest | 139 pass / 5 fail (`JoyAriaLive` c/e/f, `MobilePickupScanPage` ×2) + 24 "No test suite found" from node:test files |
| web lint | 27 errors / 5 warnings |
| E2E | none existed (`.smoke/` had a login/drawer smoke only) |

User WIP left untouched: `.claude/settings.local.json` (deleted), `.smoke/`, `web/vault/`.

## Completed

### Found only by the end-to-end run

| id | problem | change | validation | commit |
|---|---|---|---|---|
| E1 | **Second customer/seller insert fails with 23505 `IX_Customers_PicklistBarcode`.** Migration `20260426_AddPicklistBarcodes` made the column unique and backfilled existing rows, but nothing ever assigned a value to new rows — first one got `""`, every later one collided. Order import, customer create, seller create, walk-up customer all affected. | `AppDbContext.SaveChangesAsync` assigns `PLB-`/`PLS-` + 8 hex (the migration's format) to any added Customer/Seller without one | 3 tests; E2E import of 4 customers / 2 sellers | 3bf48fc |
| E2 | Orders import rejected the app's **own downloadable template** (`CustomerDisplayName, SellerDisplayName, PlantSKU, Qty, Notes`) — "No adapter matched" | `TemplateOrdersAdapter`; blank-numbered rows for the same customer now group into one order (was one order per row); `Notes` lands on the line | Test imports the template verbatim; E2E 5/5 rows | 21b633c |
| E3 | Closing a register sale landed on "Not found" + `GET /api/customers/undefined` — walk-up orders have no customer but the web `Order.customerId` type said `string` | Type is `string \| null`; the 7 sites the compiler then flagged (print sheets, lookup-print station/search, pickup lookup, order edit) skip/guard the customer fetch | tsc; E2E close → prints walk-up sheet | 590e475 |
| E4 | Live KPI / daily sales / payment breakdown / walk-up-vs-preorder reported **$100 revenue for a $4.25 sale** (they summed `AmountTendered`, i.e. cash handed over incl. change) and **$0 for every preorder** | Revenue = Σ qtyOrdered × price per order everywhere, matching the sales-by-* reports | 3 report tests updated to price-based fixtures; E2E $4.25 / $89.48 | 6e0cb5d |
| E5 | An order picked entirely on the phone stays `InProgress` forever — mobile has no "Complete Order" control (desktop does) — so completed-order KPIs under-count | Mobile scan page calls the existing complete endpoint (server re-validates all lines fulfilled) after the scan that fulfils the last line, then shows the complete scene | 2 vitest tests; E2E third scan → "Order 2 complete" | 83989d2 |
| E7 | **Inventory "Adjust" has never worked from the UI** — the page posted `plantCatalogId`, the API binds `PlantId` → 400 "Plant ID is required." on every attempt | Payload/type use `plantId`; modal test pins the field | E2E negative adjust now reaches the service and is rejected for the right reason | c27593d |
| E6 | Every mobile page load logged a `HEAD /api/` 404 (availability probe hit a route that doesn't exist; only "worked" because <500 counted as up) | `MapHealthChecks("/api/health")`; probe that | E2E console clean | fc13a0b |

### Sweep

| id | problem | change | validation | commit |
|---|---|---|---|---|
| S1 | 11 node:test files never ran; vitest choked on the node:test files (24 bogus failures); one node:test imported `.tsx` (cannot load) | `scripts/run-node-tests.mjs` globs `*.test.ts` outside `__tests__/`; vitest owns `__tests__/`; `npm test` runs both; `authRoutes.test.ts` moved to vitest; `scanner.types.test.ts` got a real test | 96 + 154 green | a578fb4 |
| S2 | `JoyAriaLive` cleared/re-set text across `requestAnimationFrame` (stalls on hidden tabs, never fires under fake timers → 3 red tests); 2 scan-page tests predated the `scanId` idempotency key | Single synchronous setState with a nonce; odd nonce appends a zero-width space so identical text still re-announces; timers cleared on unmount | 6/6 + 12/12 | 6f4a356 |
| S3 | Report/print/dashboard pages set loading state synchronously in effects and applied whichever response arrived last (change a date range twice quickly → stale result wins) | `useAsyncData(load, key)` keys each load, discards superseded responses, derives loading/data/error (4 tests); 16 pages migrated; `AdminPinModal` resets by remount; barcode components defer error state; `AudioFeedback`/`JoyAriaLive` non-component exports split out | lint 24 → 0; tsc; suites | 22a62f3 |
| S4 | Lookup pages reset to idle inside the debounce effect; scan page re-derived loading on every `orderId` change | Reset in the value handler (also retires in-flight request); scan page keyed per order by its wrapper | 58/58 mobile tests | ca3bd64 |
| S5 | Lint hygiene: unused `_tick`, intentional control-char regex, 4 stale `eslint-disable`, missing dep | Cleared | lint | 2a3e542 |
| S6 | 5 XML-doc build warnings | Documented the import query flags | build 0 warnings | 6f38c6e |

### Audit fixes (three worktree workers, one commit each)

API — fulfillment / inventory / walk-up: raw 40001/40P01 now retried in pickup
and session scans + quiet rollback (5616cb3); register adjust-line override
requires a valid PIN and can never drive on-hand negative (7067427); `/api/walkup`
writes retried and order-number collisions retried (54fa07d); walk-up line
update validates availability (a12a6d7); inventory adjust refuses < 0 and locks
the row (1a26e94); completed orders no longer count as commitments (012ab1f);
scans/manual-fulfil/complete refuse orders that are not Open/InProgress
(c401800).

API — reports / import / customers: Cancelled excluded from every aggregate
(abc3b7e); customer/seller update validators + pickup-code uniqueness
(1b60a94); import batch saved only on success (376911d); currency-formatted
prices parse and a blank price no longer nulls an existing one (2e0cf8c);
invalid order quantities reported instead of coerced to 1 (b225945);
soft-deleted order numbers / pickup codes honoured, case-variant keys tolerated
(669471c).

API — auth / security: constant-time PIN compare + per-IP PIN-failure lockout
with Warning logs (3f7539d); login rate limit 10/min per IP → 429 (50f0ed0);
cookie principal re-validated every request so disabling a user or changing
roles takes effect immediately (d4a1e24); deny-by-default fallback policy with
health endpoints anonymous (75598a2); user create/reset-password validators
actually run (9576e07); sale-closed audit uses the validated header reason
(4406400); dummy-hash verify for unknown usernames (15606cf); middleware
handles client disconnects and started responses (6b8d339); bootstrap password
hashed only on create — it was silently reset on every restart (ad6f741).

Web — pickup / register / mobile: stray wedge scans can no longer set the
quantity instead of scanning (digit shortcut removed, ScanInput recaptures
focus, refocus after qty change) (a1aa85a); register normalises printed-label
barcodes like pickup does (e69102d); register scanId is retry-stable (08e2e92);
expired session redirects to login instead of banner-looping (168bc0d); session
close failure no longer navigates away (82be6bc); undo history only on Accepted,
no `window.prompt` (815c158); manual-fulfil errors surfaced (0cc7de0); stale
poll responses discarded (15a3bb9); pick-list lookup spinner hang fixed
(24b990c); camera stream released on late start (bdb7fa7); one shared
AudioContext (7e7a622); station home shows live stats instead of hardcoded
38/241/12 (387f91c).

Web — admin / orders / print: orders list sort honoured server-side (a83d5f5);
inventory adjust double-submit guard (890aca6); edit-order resyncs after a
partial save failure so lines are not duplicated (34e15a3); search-bar Enter
reaches scan-to-search (a9e2ce2); batch print pages load per record with
bounded concurrency and report failures (83fc2d5); FileUploader explains
rejections and caps uploads at 10 MB (eb22357); "/" focus on plants (9db1d01);
CSV preview uses a real parser (828ec32); CSV export neutralises formula
injection (b96f7f4); modals get dialog semantics, Escape and focus (b59a3d1).

Verified by the auditors as already correct: `WalkUpRowLocks` retry/backoff,
EF configurations, B1–B9 from the previous sweep, W1/W2/W4/W5/W7, password
hashing, CORS, cookie flags, DI lifetimes, expiry hosted service, CSV export
MIME/BOM, admin PIN headers on every gated call.

## End-to-end harness

`.e2e/` (untracked, excluded via `.git/info/exclude`) — Playwright 1.59 spec that
logs in, imports plants/inventory/orders from the shipped templates, crawls all
44 admin + mobile + print routes, sells at the register (incl. an oversell
attempt and close), scans a pickup on desktop and on a 390 px phone, reads back
the reports, and exercises the audit fixes (server-side sort, zero-padded label
at the register, PIN-gated cancel, negative inventory rejection, cancelled
order excluded from the dashboard, expired cookie → login). Stack: Postgres in Docker on 5439, API on 5289, web as a
production build via `vite preview` on 5187 (`web/vite.e2e.config.ts`, untracked).
The dev server was too heavy for headless Chrome on this host (44 pages ×
hundreds of module requests → `ERR_INSUFFICIENT_RESOURCES`). Run details are in
the project memory `e2e-harness`.

## Audit pass

Five read-only auditors covered API auth/security, API fulfillment/inventory/
walk-up, API import/report/customer, web mobile/pickup/register, and web
admin/orders/print (59 findings). Two of their highs were the same defects the
E2E had already hit (E1 PicklistBarcode, E3-adjacent). The confirmed,
autonomous-class findings were fixed by three worktree workers — see the
"Audit fixes" table below. Everything else is listed under Deferred with the
reason.

## Deferred (unchanged from 2026-08-16 unless noted)

### From the audit pass — architecture / product calls
- **Lock order is inconsistent across services** (scan: Inventories→OrderLines;
  manual fulfil and register adjust: OrderLines→Inventories; session scan:
  ScanSessions→OrderLines→Inventories; `WalkUpRowLocks`: Plant→Inventory→
  OrderLine). A per-order scan concurrent with a session scan on the same
  order can deadlock (40P01 after 1 s). With the retry wrappers now in place
  the loser retries instead of 500ing, but the fix proper is one canonical
  order (Plant → Inventory → OrderLines sorted by Id → Event) applied to all
  seven paths — a coordinated change that needs a Postgres-backed test.
- **Register scan idempotency remembers only the last scanId per line** — a
  delayed client retry of an older id after a newer scan re-applies. Needs a
  per-draft scan-id table (the pickup path already has `(OrderId,
  IdempotencyKey)` unique).
- **Pickup lookup fans out up to ~52 requests per keystroke**
  (`PickupLookupPage`: customers list → one orders list per customer → …).
  Replace with a single `ordersApi.list({search})` grouped client-side; the
  page's phone/name/pickup-code matching rules need a product check first.
- **Customer/seller mutation is open to every LookupCapable role** and
  single-entity deletes need no PIN while bulk deletes do. Policy decision.
- **Order status hygiene**: `UpdateAsync`/`BulkSetStatus` accept any target
  status incl. Draft; `ResetOrderAsync` only flips Complete→InProgress although
  the controller doc says it clears progress; `PlantService.UpdateAsync` can
  change a barcode after labels were printed (`BarcodeLockedAt` unenforced).
- Import history / issue lists hard-capped at 100 / 200 with no paging;
  imports buffer the whole upload (Kestrel's 30 MB default is the only cap).
- Soft-deleting a customer/seller/plant drops its orders from the per-entity
  reports but not from totals (the two stop reconciling).
- Secure-only cookies with an all-HTTP compose stack: fine behind the TLS
  proxy the README assumes; a bare `http://<LAN-IP>:3000` fallback would log
  in and then 401 everywhere. Document, or add `UseForwardedHeaders`.
- Live-sale-kpi is `[AllowAnonymous]` by design (projector) — it publishes
  sale totals on the internet-facing host.

### Carried forward

- **Product** — `ScanInput` drops an identical barcode within 2 s with no
  feedback. *Reproduced in E2E*: scanning two of the same plant 0.7 s apart on
  the desktop pickup station fulfilled one; the volunteer sees nothing. The
  server already dedupes by `scanId`, so the client window is redundant.
- **Product** — `ExceptionHandlerMiddleware` echoes raw exception text on 500s
  (kept because `errorMessaging.ts` maps it into volunteer guidance).
- **Product / cross-stack** — Register "Manager Override" cannot succeed (lines
  carry no barcode; fallback scan is re-rejected). E2E confirms the path is
  reachable: an over-availability scan shows "Manager override required".
- Mobile scan page shows the previous accepted message under the new banner
  (live region + banner both render the last two messages). Cosmetic.

## Remaining ranked queue

1. Remove or surface the 2 s client-side duplicate-scan window (above).
2. Manager override on the register.
3. Add a Postgres-backed integration test project (Testcontainers) for the
   invariants the in-memory provider cannot check — unique indexes, FK
   delete behaviour, `FOR UPDATE` locking. E1–E3 would all have been caught.
4. Wire `.e2e/` into the repo (commit the spec + config, gitignore results) and
   run it in CI against `docker compose`.
5. Operational: the login limiter is 10/min per IP and the PIN lockout 30
   failures/min per IP — a NAT'd venue shares one IP, so confirm those numbers
   before sale day; the cookie is now re-validated per request (one extra
   query).

## Stop reason

Everything reachable through the UI on a clean database now works end to end;
the remaining items are product decisions or a CI/infra investment.
