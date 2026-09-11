# Improve Report — Hampton Hawks Plant Sales — sweep — 2026-08-16

## Summary

Working software with a real sale-day defect cluster in the walk-up register and
fulfillment paths. 17 local commits on `2026/08/12-0915-caleb-fix-sale-day-hardening`,
each one coherent change with a regression test where the code is unit-testable.
Not pushed.

By category: correctness 6 · data integrity 2 · reliability 5 · security 1 ·
validation 2 · testing 1.

Final validation vs baseline: API 438 pass / 0 fail / 2 skip (was 427 / 2 / 1);
API build clean (same 5 pre-existing XML-doc warnings); web `tsc -b` + Vite build
clean; `npm test` 43/43 (was 42); web lint unchanged at 27 errors / 5 warnings
(all pre-existing, mostly `react-hooks/set-state-in-effect`); vitest pre-existing
failures unchanged (see Baseline).

Stop reason: remaining candidates are product decisions, one cross-stack medium
change, or cosmetic lint — none has a favorable autonomous risk/reward.

## Baseline

| check | result |
|---|---|
| API build | OK, 5 warnings (CS1573 XML param docs in `ImportController`) |
| API tests | 427 pass / **2 fail** / 1 skip — `OrderImport_Pdf_ExtractsCustomerAndLineItems`, `PlantImport_Pdf_ThrowsHelpfulMessage` (fixture `rpcustorderspdf.pdf` deliberately removed + gitignored in 2b27e97) |
| web build | OK (chunk-size warning, `index-*.js` 1.28 MB) |
| web `npm test` (node:test) | 42 / 42 |
| web lint | 27 errors / 5 warnings, pre-existing |
| web vitest (not in `npm test`) | 138 pass / 6 fail (`JoyAriaLive` c/d/e/f timing, `MobilePickupScanPage` ×2) — verified failing at baseline commit c906391; node:test files also report "No test suite found" under vitest |

User WIP left untouched: `.claude/settings.local.json` (deleted), `.smoke/`, `web/vault/`.

## Completed

| id | problem | change | why | validation | commit |
|---|---|---|---|---|---|
| T1 | 2 tests permanently red on clean checkout (gitignored PDF fixture) | Plant-PDF test uses empty stream (only exercises extension check); order-PDF test skips itself when fixture absent via `RequiresRepoFileFactAttribute` | Fixture holds real customer data and cannot be committed | 19/20 ImportServiceTests pass, 1 skip | c6be5f9 |
| B1 | **Register refuses sales once a line reaches half the stock** — scan/adjust validated cumulative total against `OnHandQty` already decremented by that line | Validate only the increment (`requestedAdd` / `diff`) | Confirmed by repro: 10 on hand, 6th scan fails "only 5 available"; existing tests mocked the protection service | New `WalkUpRegisterAvailabilityTests` (3, real `InventoryProtectionService`) red→green | de2556d |
| B2 | Undo reversed 1 unit but retired a Quantity=N event; undo event written as `Accepted` so a second Undo undid the undo and minted phantom stock | Reverse full event quantity (clamped); new `FulfillmentResult.Undone` (stored as text, no migration; not consumed by web) | Silent over-fulfilment + inventory inflation feeding walk-up availability | 2 new tests red→green, existing undo test updated | 9b45c0f |
| B3 | Walk-up order number = filtered `Count()+1`; cancel soft-deletes → next draft collides with unique index → 500 | `WalkUpOrderNumbers.NextAsync` probes with `IgnoreQueryFilters`; register retries on 23505 | Every cancel broke the next draft at the register | Regression test red→green | 4d2a83a |
| B4 | `DELETE /api/orders/all` aborts on `ScanSessionMembers` Restrict FK | Delete members first inside the transaction | Only three tables FK to Orders (snapshot verified); wipe unusable after any scan session | Build (raw SQL, not unit-testable in-memory) | 8006777 |
| B5 | `CreateOrderValidator` ignored lines; negative qty reduces summed commitments → inflates availability | `RuleForEach(Lines)`: PlantCatalogId not empty, QtyOrdered > 0 | Oversell vector via `POST /api/orders` | 2 validator tests | 342a1f2 |
| B6 | Register adjust/void/cancel not retry-wrapped (documented invariant says conflicts are retried) | Wrap bodies in `WalkUpRowLocks.ExecuteWithRetryAsync`, draft loaded inside body | Raw 40001 aborts under concurrent registers | Full suite green | 066f161 |
| B7 | Two `RequiresAdminPinAttribute` types; filter matches only one — future wrong `using` silently disables PIN | Delete unused `Api.Attributes` copy; fix stale doc | All 12 usages import Filters (verified) | Build | e5e8af3 |
| B8 | Caller-supplied duplicate `OrderNumber` → raw 500 | Check (ignoring soft-delete filter) → `ValidationException` | Same error the importer already gives | Test | edde0fb |
| B9 | `CreateAsync` with `IsWalkUp` + `Lines` bypassed availability (CLAUDE.md invariant) | Same lock/validate/retry scope as `AddLineAsync`, grouped per plant | Documented invariant, oversell path | Test with real protection service | 6b90bae |
| W1 | Interceptor rejected bare `Error`; every `err.status` / `err.code` branch dead (401→login never fired on mobile) | `toApiError` keeps `status` + `code`; lookup page checks `status` too | Expired session showed raw "Unauthorized" | node test + tsc | f19bd5c |
| W2 | Camera dead after phone backgrounds (tracks stopped, status stayed `active`, no restart); zxing callback kept first `onScan` so wrong-code-type guard saw `order===null` | Full stop on hide + restart on visible; `onScanRef` | Most likely mobile scan failure on sale day | 2 vitest tests red→green; suite otherwise unchanged | 69a394b |
| W3 | Pickup Reset / Mark partial had no error handling; Complete swallowed errors behind a wrong comment; no double-tap guard | `runOrderAction` helper: busy flag, `actionError` banner, refocus | Silent failure of PIN-gated destructive actions | tsc, eslint | dfe0946 |
| W4 | Second `openPinModal` overwrote `pinResolve` → first caller's await hangs forever | Resolve prior caller with `null` | Reachable (Void then Cancel Sale) | node test | 6de8bb4 |
| W5 | Backend-availability poll leaked one 30 s loop per mount (in-flight fetch reschedules after unmount) | `cancelledRef` | Kiosk navigation accumulates loops | tsc, eslint | 0db606f |
| W6 | Failed price fetch cached as `null` → line totals `$0.00`, Grand Total silently short | Don't cache failures (retry next update); amber "N lines without a price — not included" note | Null catalog price is legitimate, so not blocking Close Sale | tsc, eslint | 3f838ac |
| W7 | 350 ms auto-navigate fired even if lookup superseded / page left | Guard on request id; bump on unmount | Small correctness edge | tsc | 4c79757 |

## Deferred

- **Product** — `ScanInput` drops an identical barcode within 2 s with zero feedback (`ScanInput.tsx:40`). Server-side `scanId` dedupe already exists; either remove the window or surface "duplicate ignored". Changes scan behavior — needs a call.
- **Product** — `ExceptionHandlerMiddleware` echoes `exception.Message` on 500s (DB/constraint names reach clients). Left as-is because `errorMessaging.ts` deliberately maps raw server text ("deadlock", "serialize access") into volunteer guidance and shows "Technical details" for admins; redacting 500s would break that design.
- **Product / medium cross-stack** — Register "Manager Override" cannot succeed: it matches a barcode against `plantSku`/`plantName` (lines carry no barcode) and falls back to a header-less `scan` the server re-rejects (`WalkUpRegisterPage.tsx:256-277`). Needs either `PlantBarcode` on `OrderLineResponse` + adjustLine, or an override path on `ScanIntoDraft`. Note B1 removes most spurious "availability exceeded" errors, so the override is now needed only for genuinely preorder-committed stock.
- **Insufficient evidence** — explorer claim that `ScanId` > 64 chars causes a 22001: column is Postgres `text` (migration verified), so no; the register controller's missing validator injection is redundant with service checks. Reverted the drafted change.

## Remaining ranked queue

1. Manager override on the register (above) — high value if managers need to sell past preorder commitments at the register.
2. Duplicate-scan feedback in `ScanInput` (above).
3. `PickupScanSessionPage.handleEndSession` navigates before a failed `closeSession` can render its error (unverified, low confidence).
4. Lint hygiene: `_tick` unused param (`LiveSaleKpiPage.tsx:484`), `no-control-regex` on an intentional control-char strip (`orderLookup.ts:3`), 4 stale `eslint-disable no-console` directives, `orderId` missing from a `useCallback` dep list that only feeds a `console.debug`. Cosmetic; `npm run lint` will keep failing until the 22 `set-state-in-effect` findings are addressed as a deliberate pass.
5. Add `'Undone'` to the web `FulfillmentResultType` union if the event-history endpoint is ever consumed.
6. Add the vitest suite (and the node:test files it currently can't load) to a single test entry point; today `npm test` covers 10 files and vitest covers a disjoint set with 5–6 pre-existing failures.

## Stop reason

No remaining high-confidence, evidence-backed change is both autonomous-class and
behavior-preserving. The rest needs a product decision or a cross-stack design
choice.
