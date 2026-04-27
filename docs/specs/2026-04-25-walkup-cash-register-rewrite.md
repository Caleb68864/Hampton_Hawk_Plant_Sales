# Walk-Up Cash Register Rewrite

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-25
- Author: Caleb Bennett
- Source: `docs/plans/2026-04-25-walkup-cash-register-rewrite-design.md` (evaluated)
- Status: ready-to-execute
- Quality scores: Outcome 5 / Scope 5 / Decision 5 / Edges 5 / Criteria 4 / Decomposition 4 / Purpose 5 — **Total 33/35**

## Outcome
A new `WalkUpRegisterPage` replaces the form-based `WalkUpNewOrderPage` with a cash-register flow: cashier opens a `Draft` order, scans plants directly into it (each scan +1 qty, atomic inventory decrement, walk-up protection enforced), watches a running grand total, and clicks Close Sale to finalize. Drafts persist across reloads. Per-line void / cancel-sale / over-limit override are admin-pin gated and audited.

## Intent
**Trade-off hierarchy:**
- **Correctness over speed.** Inventory must never go negative; concurrent stations must not oversell. The transactional contract is the load-bearing piece.
- **Refresh-safe over local convenience.** Drafts live on the server; the browser is a thin view.
- **Existing patterns over invention.** Mirror `FulfillmentService.ScanBarcodeAsync` shape for the scan endpoint.
- **Auditable over silent.** Every admin override / void / cancel writes `AdminAction`.

**Decision boundaries:**
- Decide autonomously: page layout, helper structure, idempotency key generation, inline copy.
- Recommend + ask: `Order.CustomerId` nullable scope, payment metadata model, default expiry, deprecation timing of the old endpoints.
- Stop and ask: anything that would require changing the preorder flow contract; performance regressions >250ms scan latency under 10 stations; any change that would expose payment info beyond simple metadata.

## Context
The current walk-up flow (`WalkUpNewOrderPage` + `WalkUpService`) is form-driven: select customer, search plants, set qty, override admin, submit. It is broken (per user) and slow at sale day. A cash-register flow scans plants directly into a persisted draft. Inventory decrements at scan time (mirroring how preorder fulfillment decrements today), so concurrent stations cannot oversell.

**Schema confirmed:**
- `Order` has `CustomerId` (Guid, NOT nullable today), `IsWalkUp`, `Status` (`OrderStatus` enum: needs `Draft` added), `OrderNumber`.
- `OrderLine` has `QtyOrdered`, `QtyFulfilled`, `Notes`.
- `PlantCatalog.Price` is `decimal?`; nullable price = $0 line.
- `Inventory.OnHandQty` is the canonical inventory count.
- `IInventoryProtectionService.ValidateWalkupLineAsync` already encapsulates walk-up math.
- `IAdminService.LogActionAsync` is the audit pattern.
- `start.bat` runs the docker stack; the dev server is reachable at the user's local network address.

## Requirements

1. `OrderStatus` gains `Draft`. Soft-delete + report query filters EXCLUDE drafts from sales reports by default.
2. `Order.CustomerId` becomes nullable for walk-up draft orders only (preorder customers still required). Implementation: column nullable in DB; existing reads adjusted.
3. Optional `Order.PaymentMethod` (string?) and `Order.AmountTendered` (decimal?) columns added; nullable; only set on close.
4. New service `IWalkUpRegisterService` exposes: `CreateDraftAsync`, `ScanIntoDraftAsync`, `AdjustLineAsync`, `VoidLineAsync`, `CloseDraftAsync`, `CancelDraftAsync`, `GetOpenDraftsAsync`.
5. New controller `WalkUpRegisterController` exposes endpoints listed in sub-spec acceptance criteria; all return `ApiResponse<T>`; admin-only operations are `[RequiresAdminPin]`.
6. `ScanIntoDraftAsync` runs in a single transaction: locks plant + line, validates walk-up availability, decrements inventory, upserts line; idempotency enforced via a client-supplied `scanId` persisted on `OrderLine` (column `LastScanIdempotencyKey`).
7. New page `WalkUpRegisterPage` (replaces `WalkUpNewOrderPage` for primary flow) renders ticket + total + barcode-input cursor; persists `draftId` in `appStore`; recovers draft on reload.
8. Existing `/api/walkup/orders/...` endpoints and `WalkUpNewOrderPage` remain available for one release window; a feature flag (or always-on link from station home) lets admins fall back during the transition.
9. All new code passes `dotnet build` / `dotnet test` and `npm run build`; tests cover idempotency, concurrent scan from two simulated stations, walk-up limit, override flow, void-line restore, cancel-draft restore, close with zero/many lines.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Schema additions -- OrderStatus.Draft, nullable CustomerId, payment metadata

- **Scope:** Add `Draft` to `OrderStatus` enum. Make `Order.CustomerId` nullable in DB and EF config. Add nullable `PaymentMethod` (string?) and `AmountTendered` (decimal?) columns. Add `OrderLine.LastScanIdempotencyKey` (string?, indexed). Update soft-delete and existing query filters where `Status` is referenced. Update `OrderResponse` DTO to include the new fields. Update `IReportsService` queries to exclude `Status=Draft`.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Enums/OrderStatus.cs`
  - `api/src/HamptonHawksPlantSales.Core/Models/Order.cs`
  - `api/src/HamptonHawksPlantSales.Core/Models/OrderLine.cs`
  - `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/OrderConfiguration.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/OrderLineConfiguration.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs` (filter Drafts)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` (filter Drafts from generic list by default; allow `?includeDraft=true`)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{timestamp}_WalkUpRegisterSchema.cs` (generated)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `OrderStatus` enum contains `Draft`.
  - `[STRUCTURAL]` `Order.CustomerId` is `Guid?` and the EF configuration marks it nullable; `Order.PaymentMethod` is `string?`; `Order.AmountTendered` is `decimal?`.
  - `[STRUCTURAL]` `OrderLine.LastScanIdempotencyKey` is `string?` with an index.
  - `[MECHANICAL]` `dotnet ef migrations script` shows additive migration with the column changes.
  - `[BEHAVIORAL]` `GET /api/orders` returns no orders with `Status=Draft` by default.
  - `[BEHAVIORAL]` `GET /api/reports/dashboard-metrics` totals exclude `Status=Draft` orders.
  - `[MECHANICAL]` All existing tests pass after the migration is applied.
  - `[STRUCTURAL]` Every consumer of `Order.CustomerId` (services, controllers, mappers, print pages) is audited and updated to handle null. Verifiable by code review noting each touch point in the PR description.
- **Dependencies:** none

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. WalkUpRegisterService -- backend

- **Scope:** Implement `IWalkUpRegisterService` with all listed methods. Each write path uses `BeginTransactionAsync()` + `SELECT ... FOR UPDATE`. Reuse `IInventoryProtectionService` math; reuse `IAdminService.LogActionAsync` for audit; reuse `Random.Shared`-based pickup code generator only for new walk-up customers. Idempotency via `LastScanIdempotencyKey` upsert.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/IWalkUpRegisterService.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/DTOs/WalkUpRegisterDtos.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/Validators/...` (new validators per request DTO)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/WalkUpRegisterService.cs` (new)
  - `api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpRegisterController.cs` (new)
  - `api/src/HamptonHawksPlantSales.Api/Program.cs` (DI registration)
  - `api/tests/HamptonHawksPlantSales.Tests/WalkUp/WalkUpRegisterServiceTests.cs` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `IWalkUpRegisterService` exposes the 7 methods listed in Requirements (Create/Scan/Adjust/Void/Close/Cancel/GetOpen).
  - `[BEHAVIORAL]` `POST /api/walkup-register/draft { workstationName }` returns 200 + a new draft `Order` with `Status=Draft`, `IsWalkUp=true`, `CustomerId=null`.
  - `[BEHAVIORAL]` `POST /api/walkup-register/draft/{id}/scan { plantBarcode, scanId }` decrements `Inventory.OnHandQty` by 1 and inserts/increments the draft's `OrderLine` for that plant within a single transaction.
  - `[BEHAVIORAL]` Two parallel `scan` requests with the SAME `scanId` produce ONE inventory decrement and ONE line increment (idempotency).
  - `[BEHAVIORAL]` Two parallel `scan` requests with DIFFERENT `scanId` for the SAME plant from DIFFERENT drafts: total decrement equals sum of both; neither overdraws beyond `OnHandQty`.
  - `[BEHAVIORAL]` `scan` against a plant whose walk-up availability is 0 returns 422 `ApiResponse.Fail` with descriptive message; no inventory change.
  - `[BEHAVIORAL]` `POST /api/walkup-register/draft/{id}/lines/{lineId} (DELETE / void)` with admin pin restores inventory and soft-deletes the line; logs `AdminAction`.
  - `[BEHAVIORAL]` `POST /api/walkup-register/draft/{id}/cancel` with admin pin restores inventory for ALL lines and soft-deletes the draft; logs one `AdminAction` per line plus one for the cancellation.
  - `[BEHAVIORAL]` `POST /api/walkup-register/draft/{id}/close { paymentMethod, amountTendered }` with at least one line flips `Status=Completed` and persists payment metadata; with zero lines returns 422.
  - `[BEHAVIORAL]` `GET /api/walkup-register/draft/open?workstationName=Pickup-1` returns drafts not closed/cancelled.
  - `[STRUCTURAL]` Each write method invokes `BeginTransactionAsync()` and uses `SELECT ... FOR UPDATE` (verifiable via code review or via a parallel-scan integration test that demonstrates serialization).
  - `[INFRASTRUCTURE]` All new endpoints work against the existing docker-compose Postgres without additional configuration.
  - `[MECHANICAL]` `dotnet build` / `dotnet test` succeed including the new tests.
- **Dependencies:** SS-01

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
---

### 3. WalkUpRegisterPage -- frontend

- **Scope:** New page replacing the primary path of `WalkUpNewOrderPage`. Renders ticket + grand total + barcode input. Persists `draftId` in `appStore` keyed by workstation. Resumes on reload.
- **Files:**
  - `web/src/api/walkupRegister.ts` (new)
  - `web/src/types/walkupRegister.ts` (new)
  - `web/src/stores/appStore.ts` (extend with `walkUpDraftIdByWorkstation`)
  - `web/src/pages/walkup/WalkUpRegisterPage.tsx` (new)
  - `web/src/pages/station/StationHomePage.tsx` (add "New Sale" + "Resume Open Tickets")
  - `web/src/routes/...` (route registration)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `WalkUpRegisterPage` renders a barcode input that auto-focuses, a ticket table (plant, sku, unit price, qty, line total, void), and a grand total in large type.
  - `[BEHAVIORAL]` Clicking "New Sale" creates a draft via API, stores `draftId` in `appStore`, and renders the empty register; reloading the page returns to the same draft (resume).
  - `[BEHAVIORAL]` Scanning a known plant tag adds a line (or increments existing line) and updates the grand total without a page reload.
  - `[BEHAVIORAL]` Scanning a plant whose walk-up availability is 0 shows an inline error and offers a "Manager Override" button that prompts for admin pin + reason and retries the scan via `AdjustLineAsync`.
  - `[BEHAVIORAL]` "Close Sale" prompts for `paymentMethod` and `amountTendered`, calls the close endpoint, and navigates to a receipt view (existing print page or a simple summary).
  - `[BEHAVIORAL]` "Cancel Sale" prompts for admin pin + reason and cancels the draft.
  - `[BEHAVIORAL]` Each scan generates a fresh client-side `scanId` (e.g., `crypto.randomUUID()`); the API call sends it; the UI does not re-use the same scanId across distinct scans.
  - `[INTEGRATION]` Run start-to-finish on the dev container: open New Sale, scan 3 plants, close with cash $20.00 -- `Order.Status` is `Completed`, `Inventory.OnHandQty` decreased by 3 across the involved plants, and a receipt view renders.
  - `[MECHANICAL]` `npm run build` succeeds.
- **Dependencies:** SS-02

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-03']
---

### 4. Coexistence with legacy walk-up + station home updates

- **Scope:** Keep `WalkUpNewOrderPage` and `/api/walkup/orders/...` operational for one release. Update station home to make Register the primary action; legacy walk-up is a labeled fallback under "Old Walk-Up Form". Document the deprecation in `docs/cheatsheets/`.
- **Files:**
  - `web/src/pages/station/StationHomePage.tsx`
  - `web/src/pages/walkup/WalkUpNewOrderPage.tsx` (banner: "Legacy form -- use the Register for new sales")
  - `docs/cheatsheets/walkup-register.md` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` Station home shows "New Sale (Register)" as the primary action and "Old Walk-Up Form (legacy)" as a secondary action.
  - `[STRUCTURAL]` `WalkUpNewOrderPage` still renders without errors and still creates orders via the legacy endpoints.
  - `[STRUCTURAL]` `docs/cheatsheets/walkup-register.md` documents the new flow + the deprecation note for the legacy form.
  - `[MECHANICAL]` `dotnet test` and `npm run build` pass.
- **Dependencies:** SS-03

## Edge Cases
- Scanner double-fire: same `scanId` -> single decrement (idempotent).
- Two cashiers scan the same popular plant simultaneously: row lock serializes; one wins; the other gets `out of stock` if availability hits 0.
- Network timeout mid-scan: client retries with the same `scanId`; server returns the original outcome.
- Draft abandoned mid-sale: persists server-side; recoverable from "Open Tickets".
- Close with zero lines: rejected with 422.
- Reduce qty below `QtyFulfilled`: rejected unless admin override.
- Cancel draft restores inventory for every line; if any restore fails, transaction rolls back; `AdminAction` records the attempt.
- `PlantCatalog.Price` is null: line total is $0 (no error; ticket displays `--`).
- Cash drawer / change calculation: out of scope; cashier handles manually.
- **Order.CustomerId nullable migration audit.** Making CustomerId nullable affects every existing read that assumes non-null. SS-01 MUST grep the codebase for `CustomerId` references and verify each handles null (e.g., in `OrderResponse` mapping, in reports, in print pages). Any consumer that crashes on null gets a defensive null-check or an `IsWalkUp` filter.
- **Hosted expiry service resilience.** `ScanSessionExpiryHostedService` would normally apply to scan sessions; for walk-up drafts, no auto-expiry. If a future maintenance loop is added, it MUST catch and log exceptions per iteration so a single iteration failure does not stop the loop.
- **Client-side scanId discipline.** `WalkUpRegisterPage` MUST generate a fresh `scanId = crypto.randomUUID()` immediately before each scan request. The same scanId is only re-used by the HTTP retry layer (e.g., axios interceptor) when a request times out. Add an explicit unit test that two manual scans produce two distinct scanIds.

## Out of Scope
- Card terminal / payment processing.
- Receipt printer drivers (HTML print only).
- Discounts, coupons, loyalty, multi-rate pricing.
- Tax calculation (assume tax-exempt fundraiser).
- Refund flow after `Close Sale`.
- Multi-currency, partial returns, voiding closed sales.
- Replacement of preorder walk-up endpoints in this PR (deferred one cycle).
- Live broadcast of draft state across stations.
- Per-cashier accountability beyond `workstationName`.

## Constraints

### Musts
- Single-transaction atomic decrement+upsert per scan with row locks.
- Idempotency keys persisted on `OrderLine`.
- All admin operations admin-pin gated and audited via `AdminAction`.
- Status `Draft` excluded from sales reports by default.
- Existing `/api/walkup/orders/...` endpoints unchanged for one release.
- All endpoints return `ApiResponse<T>`.

### Must-Nots
- MUST NOT modify the preorder fulfillment contract.
- MUST NOT process payment data beyond `paymentMethod` + `amountTendered` columns.
- MUST NOT introduce per-line price overrides.
- MUST NOT auto-cancel drafts on idle.
- MUST NOT alter existing `OrderStatus` values' semantics.

### Preferences
- Prefer `crypto.randomUUID()` for `scanId`.
- Prefer existing `IAdminService.LogActionAsync` for audit; do not introduce a new audit table.
- Prefer reusing the existing customer search component if a customer info panel is added.
- Prefer Tailwind-only styles consistent with existing pages; no new CSS frameworks.

### Escalation Triggers
- Any need to alter the preorder flow or `IFulfillmentService` contract.
- Performance regressions: scan latency > 250 ms under simulated 10 stations.
- Required column shape that cannot be expressed as additive nullable.
- New external dependency required.

## Verification

1. `dotnet build` / `dotnet test` clean.
2. Apply migration; `psql` confirms new columns and enum value.
3. `npm run build` clean.
4. Concurrent-scan test (in-test or smoke): two parallel `scan` calls with same scanId -> 1 decrement; with distinct scanIds for same plant from two drafts -> 2 decrements; with distinct scanIds when only 1 unit available -> 1 succeeds, 1 returns 422.
5. End-to-end smoke: `start.bat`; open Register; scan 3 plants; close with cash $20; receipt renders; `Order.Status=Completed`; inventory reduced; `AdminAction` empty for happy path.
6. Override smoke: scan a plant at 0 walk-up availability; click Manager Override; supply pin + reason; line is added; `AdminAction` row exists; inventory decremented.
7. Cancel smoke: open Register; scan 2 plants; click Cancel Sale; supply pin + reason; inventory restored; draft soft-deleted; `AdminAction` rows present.
8. Resume smoke: open Register; scan 1 plant; reload tab; ticket retains the line.
9. Reports smoke: `GET /api/reports/dashboard-metrics` does not count drafts in totals.

## Phase Specs

Refined by `/forge-prep` on 2026-04-25.

| Sub-Spec | Phase Spec |
|----------|------------|
| SS-01 Schema additions | `docs/specs/walkup-cash-register-rewrite/sub-spec-1-schema-additions.md` |
| SS-02 WalkUpRegisterService -- backend | `docs/specs/walkup-cash-register-rewrite/sub-spec-2-walkup-register-service.md` |
| SS-03 WalkUpRegisterPage -- frontend | `docs/specs/walkup-cash-register-rewrite/sub-spec-3-walkup-register-page.md` |
| SS-04 Legacy coexistence + station home | `docs/specs/walkup-cash-register-rewrite/sub-spec-4-legacy-coexistence.md` |

Index: `docs/specs/walkup-cash-register-rewrite/index.md`
