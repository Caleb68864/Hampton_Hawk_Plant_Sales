# Pick-List Barcode Workflow

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-25
- Author: Caleb Bennett
- Source: `docs/plans/2026-04-25-picklist-barcode-workflow-design.md` (evaluated)
- Status: ready-to-execute (lower priority -- ship after Quick Wins)
- Quality scores: Outcome 5 / Scope 5 / Decision 5 / Edges 4 / Criteria 4 / Decomposition 4 / Purpose 5 — **Total 32/35**

## Outcome
A cashier scans a printed `PLB-XXXXXXXX` (buyer pick list) or `PLS-XXXXXXXX` (student pick list) at the pickup lookup screen. The system creates a `ScanSession` aggregating every open `Order` for that customer or seller, navigates to a session scan page, and routes per-plant scans to the correct `OrderLine` across all included orders. Closing the session does NOT auto-complete its orders. The existing per-order scan flow remains unchanged.

## Intent
**Trade-off hierarchy:**
- **Reuse existing fulfillment over reinvention.** Per-line row locks, FulfillmentEvents, and per-order completion stay exactly as today.
- **Server-side aggregation over client-side.** Sessions live in the database for refresh-safety and multi-cashier coordination.
- **Stable identity over rotated codes.** Each Customer/Seller's pick-list barcode is permanent.
- **Conservative scope.** Multi-order ad-hoc expansion stays gated and off by default in v1.

**Decision boundaries:**
- Decide autonomously: barcode generator length/alphabet, internal model layout, route names.
- Recommend + ask: default expiry, whether to add `SessionId` FK on `FulfillmentEvent`, whether to expose ad-hoc expand in v1.
- Stop and ask: any need to modify per-order scan flow or `IFulfillmentService` contract.

## Context
The existing per-order pickup flow loads one order at a time. A customer with multiple orders, or a student delivering multi-order pickups, has no efficient queue. This design embeds a per-entity barcode (`PLB-` for buyers/customers, `PLS-` for students/sellers) on the existing summary print pages and adds a server-computed scan session that aggregates `OrderLine` rows across the entity's open orders.

**Existing scan flow patterns to mirror:**
- `FulfillmentService.ScanBarcodeAsync` -- `BeginTransactionAsync()` + `SELECT FOR UPDATE` on the candidate `OrderLine`.
- `useScanWorkflow` hook drives the scan UX; will be extended (not duplicated) to target either an order or a session id.
- `looksLikeOrderNumberLookup` / `normalizeOrderLookupValue` in `web/src/utils/orderLookup.ts` -- extend with sibling helpers.

## Requirements

1. New `Customer.PicklistBarcode` and `Seller.PicklistBarcode` columns: unique, non-null, default-generated `PLB-{8 base32}` / `PLS-{8 base32}`. Backfill existing rows during migration.
2. New entities `ScanSession` and `ScanSessionMember` track session shell + included orders.
3. New service `IScanSessionService` exposes `CreateFromPicklistAsync`, `GetAsync`, `ScanInSessionAsync`, `ExpandAsync`, `CloseAsync`, `ExpireStaleAsync`.
4. New controller `ScanSessionsController` exposes endpoints listed in sub-spec acceptance criteria; returns `ApiResponse<T>`.
5. `ScanInSessionAsync` reuses existing fulfillment row-lock semantics; emits a `FulfillmentEvent` per successful fulfill.
6. `Status=Draft` (walk-up draft) MUST NOT be included in session aggregation.
7. `PickupLookupPage` recognizes `PLB-` and `PLS-` prefixes and creates a session via the new endpoint.
8. New `PickupScanSessionPage` reuses `useScanWorkflow` (parameterized) + existing scan UI components.
9. Existing print pages (`PrintCheatsheetPickup`, `PrintSellerPacketPage`) render the entity's pick-list barcode.
10. Sessions auto-expire after a configurable window (default 240 minutes) via a hosted background service.
11. Existing per-order scan flow and endpoints remain unchanged.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Pick-list barcode columns + entities + migrations

- **Scope:** Add `PicklistBarcode` to `Customer` and `Seller` (string, unique, non-null). Generate values for existing rows in the same migration. Add `ScanSession` and `ScanSessionMember` entities with EF configurations.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Models/Customer.cs`
  - `api/src/HamptonHawksPlantSales.Core/Models/Seller.cs`
  - `api/src/HamptonHawksPlantSales.Core/Models/ScanSession.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/Models/ScanSessionMember.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/CustomerConfiguration.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/SellerConfiguration.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/ScanSessionConfiguration.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/ScanSessionMemberConfiguration.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{timestamp}_AddPicklistBarcodesAndScanSessions.cs`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `Customer.PicklistBarcode` and `Seller.PicklistBarcode` columns exist, unique, non-null, indexed.
  - `[STRUCTURAL]` `ScanSession` (Id, CreatedAt, ClosedAt, ExpiresAt, WorkstationName, EntityKind enum, EntityId Guid?) and `ScanSessionMember` (SessionId, OrderId) entities exist with proper FKs.
  - `[BEHAVIORAL]` Migration backfill produces unique values for all existing Customer/Seller rows; SELECT shows no NULLs and no duplicates.
  - `[STRUCTURAL]` Generated barcode format is `PLB-{8 base32}` for customers, `PLS-{8 base32}` for sellers.
  - `[MECHANICAL]` `dotnet build` / `dotnet test` succeed; existing tests pass.
- **Dependencies:** none

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. ScanSessionService -- backend logic

- **Scope:** Implement `IScanSessionService` and matching controller. `ScanInSessionAsync` reuses fulfillment row-lock contract. Hosted service runs `ExpireStaleAsync` periodically. Excludes `Status=Draft` from aggregation.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/IScanSessionService.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/DTOs/ScanSessionDtos.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionService.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionExpiryHostedService.cs` (new)
  - `api/src/HamptonHawksPlantSales.Api/Controllers/ScanSessionsController.cs` (new)
  - `api/src/HamptonHawksPlantSales.Api/Program.cs` (DI + hosted service registration)
  - `api/tests/HamptonHawksPlantSales.Tests/ScanSessions/ScanSessionServiceTests.cs` (new)
- **Acceptance criteria:**
  - `[BEHAVIORAL]` `POST /api/scan-sessions { scannedBarcode:"PLB-XXXX", workstationName }` creates a session for the matching customer including all `Status IN (Open, InProgress)` orders (excluding `Draft`); returns 200 + session view with aggregated lines.
  - `[BEHAVIORAL]` `POST /api/scan-sessions { scannedBarcode:"PLS-XXXX", ... }` does the same for a seller.
  - `[BEHAVIORAL]` Unknown `PLB-`/`PLS-` returns 404 + `ApiResponse.Fail`.
  - `[BEHAVIORAL]` Customer/seller with zero matching open orders returns 422 with descriptive error.
  - `[BEHAVIORAL]` `POST /api/scan-sessions/{id}/scan { plantBarcode }` increments `QtyFulfilled` on the FIRST pending matching `OrderLine` (oldest order, then oldest line); emits `FulfillmentEvent`; returns refreshed session view + result classification.
  - `[BEHAVIORAL]` Two parallel `scan` calls for the same plant in the same session: only ONE line increments; the second returns `AlreadyFulfilled` (or routes to next pending line if any).
  - `[BEHAVIORAL]` Session past `ExpiresAt` returns 410 Gone; cannot scan into closed sessions.
  - `[BEHAVIORAL]` `POST /api/scan-sessions/{id}/close` stamps `ClosedAt`; subsequent scans return 410.
  - `[STRUCTURAL]` `ScanSessionExpiryHostedService` runs on a timer (default 5 minutes) and closes sessions with `ExpiresAt < now`.
  - `[INTEGRATION]` Seed: 1 customer with 2 open orders containing 5 distinct plants. Create session via `PLB-`. Scan all 5 plants in any order. All 5 `OrderLines` show `QtyFulfilled = QtyOrdered`. The two original orders' completion remains pending (per-order Complete is NOT auto-fired).
  - `[MECHANICAL]` `dotnet build` / `dotnet test` succeed.
  - `[STRUCTURAL]` `ScanSessionExpiryHostedService.ExecuteAsync` wraps each iteration in `try/catch` so a single failed iteration is logged and the loop continues.
  - `[BEHAVIORAL]` After the existing per-order scan path is parameterized through `useScanWorkflow`, an end-to-end regression test exercises `/pickup/{orderId}` against an order with 3 plants and confirms identical fulfillment behavior to before the change.
- **Dependencies:** SS-01

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
---

### 3. PickupLookupPage extension + PickupScanSessionPage

- **Scope:** Detect `PLB-`/`PLS-` prefix in lookup; create session and navigate. New session scan page reuses existing scan components and a parameterized `useScanWorkflow`.
- **Files:**
  - `web/src/utils/orderLookup.ts` (new helpers)
  - `web/src/api/scanSessions.ts` (new)
  - `web/src/types/scanSession.ts` (new)
  - `web/src/pages/pickup/PickupLookupPage.tsx`
  - `web/src/pages/pickup/PickupScanSessionPage.tsx` (new)
  - `web/src/hooks/useScanWorkflow.ts` (parameterize for `mode: 'order' | 'session'`)
  - `web/src/routes/...` (route registration `/pickup/session/:id`)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `looksLikeBuyerPicklist` and `looksLikeStudentPicklist` helpers exist in `orderLookup.ts`.
  - `[BEHAVIORAL]` Typing or scanning `PLB-XXXXXXXX` into the lookup input triggers a `POST /api/scan-sessions` and navigates to `/pickup/session/{id}`.
  - `[BEHAVIORAL]` `PickupScanSessionPage` renders included orders as chips, an aggregated remaining-items counter, and the same `ScanInput`/`ScanFeedbackBanner`/`ScanHistoryList` components used today.
  - `[BEHAVIORAL]` Scanning a plant in the session updates the aggregated counter and history; `AlreadyFulfilled`/`NotInSession`/etc. results render the appropriate banner.
  - `[BEHAVIORAL]` "End and return to lookup" closes the session and navigates to `/pickup`.
  - `[BEHAVIORAL]` Existing per-order scan path (`/pickup/{orderId}`) still works (regression check).
  - `[INTEGRATION]` E2E: scan `PLS-XXXXXXXX` for a seller with two open orders -> session loads -> scan all 5 plants -> counter goes to zero -> close session.
  - `[MECHANICAL]` `npm run build` succeeds.
- **Dependencies:** SS-02

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-01']
---

### 4. Print pages -- render pick-list barcode

- **Scope:** Update existing summary print pages to include the new pick-list barcode in the appropriate header. No new pages.
- **Files:**
  - `web/src/pages/print/PrintCheatsheetPickup.tsx`
  - `web/src/pages/print/PrintSellerPacketPage.tsx`
  - any related summary print page for customer pick lists
- **Acceptance criteria:**
  - `[STRUCTURAL]` Each updated print page fetches its entity (customer or seller) including `PicklistBarcode` and renders a Code128 barcode of that value.
  - `[BEHAVIORAL]` Visiting the customer pick list print page for a known customer renders a scannable `PLB-` barcode with the value matching `Customer.PicklistBarcode`.
  - `[MECHANICAL]` `npm run build` succeeds.
- **Dependencies:** SS-01

## Edge Cases
- Two cashiers run sessions for the same entity simultaneously: row locks at the `OrderLine` level keep correctness; second cashier sees `AlreadyFulfilled` for fulfilled plants. Document in cashier cheatsheet.
- Customer/seller has 30+ open orders: aggregation query is indexed; payload is bounded.
- Backfill duplicates: unique index rejects; migration logic regenerates and retries.
- Sale closed: `SaleClosedBlocked` result identical to per-order scan.
- Session expired mid-use: 410 returned; UI prompts to start a new session.
- Plant exists in catalog but not in any included order: result `NotInSession` (or equivalent) with hint.
- Walk-up draft orders are excluded from aggregation by Status filter.
- Reprinting a pick list yields the same barcode (no rotation).
- **Backfill collision risk.** SS-01 backfill uses `md5(random())` substring -- with N entities and 8 hex chars (16^8 ≈ 4.3 billion), collision risk is low but non-zero. The migration MUST handle the unique index violation: either (a) loop the UPDATE inside a `DO $$ BEGIN ... EXCEPTION WHEN unique_violation THEN ... END $$` retry, or (b) seed with a longer suffix, or (c) verify post-update with `SELECT COUNT(*) FROM (SELECT "PicklistBarcode", COUNT(*) FROM "Customers" GROUP BY "PicklistBarcode" HAVING COUNT(*)>1) x` and re-generate any duplicate.
- **`useScanWorkflow` regression risk.** SS-03 parameterizes this hook for `mode: 'order' | 'session'`. The existing per-order scan path (`/pickup/{orderId}`) MUST continue to work unchanged. Add an explicit regression test that exercises the per-order path end-to-end after the parameterization.
- **Pick-list barcode physical security.** A printed `PLB-`/`PLS-` barcode found by an unauthorized party can be scanned to load that entity's fulfillment queue. Mitigation: barcodes are tied to controlled physical paper; document in the cashier cheatsheet that shred/disposal of unused pick lists is a sale-day operational responsibility. The codebase does not enforce auth on session creation (matching existing per-order scan behavior).
- **Hosted expiry service resilience.** `ScanSessionExpiryHostedService` MUST wrap each iteration in `try/catch` and log exceptions; a single failed iteration must not stop the loop.
- **Aggregation perf with many orders.** A customer with 30+ open orders could produce a large aggregated session payload. Confirm via test that `CreateFromPicklistAsync` for an entity with ≥30 open orders completes in <500 ms on the dev container; investigate query plan if it doesn't.

## Out of Scope
- Auto-completing orders on session close.
- Real-time multi-cashier presence indicators.
- Editing orders or lines from the session view.
- Pick-list barcodes for arbitrary collections beyond Customer/Seller.
- Live "active sessions" admin dashboard.
- Receipt/print integration changes beyond rendering the barcode.
- Ad-hoc expand mode (gated, off by default; v2 unless trivially included).

## Constraints

### Musts
- All endpoints return `ApiResponse<T>`.
- `ScanInSessionAsync` uses single-transaction row locks per existing `FulfillmentService` pattern.
- `Status=Draft` excluded from session aggregation.
- Existing per-order scan flow contract unchanged.
- Backfill produces unique non-null values for existing Customer/Seller rows.

### Must-Nots
- MUST NOT introduce a new fulfillment event type.
- MUST NOT auto-complete orders on session close.
- MUST NOT modify or remove existing per-order scan endpoints.
- MUST NOT collide with existing barcode prefixes (`OR-`, `PL-`, `WLK-`).
- MUST NOT enable `Expand` (multi-order ad-hoc) in v1 by default.

### Preferences
- Prefer extending `useScanWorkflow` over duplicating it.
- Prefer `Random.Shared` for barcode generation (non-cryptographic identity is fine here).
- Prefer Crockford base32 alphabet (no ambiguous chars) for barcode bodies.
- Prefer hosted background service for expiry over per-request cleanup.

### Escalation Triggers
- Any change that would alter the per-order scan flow contract.
- Backfill produces collisions despite a generous suffix length.
- Performance regressions when aggregating sessions for entities with many orders.
- Need for cross-customer / cross-seller sessions.

## Verification

1. `dotnet build` / `dotnet test` clean.
2. Migration applied; query confirms `PicklistBarcode` populated for all existing rows.
3. `npm run build` clean.
4. Manual: print a seller summary -> barcode visible; scan it at lookup -> session page loads -> scan plants -> counter decreases -> close session -> orders remain not-completed (per-order completion still required).
5. Concurrent test: two simulated stations scan same plant in two sessions for same entity -> only one line fulfills.
6. Regression: existing per-order scan flow at `/pickup/{orderId}` still works end-to-end.
7. Reports regression: dashboard metrics unaffected by the new schema changes.

## Phase Specs

Refined by `/forge-prep` on 2026-04-25.

| Sub-Spec | Phase Spec |
|----------|------------|
| SS-01 Schema additions | `docs/specs/picklist-barcode-workflow/sub-spec-1-schema-and-entities.md` |
| SS-02 ScanSessionService -- backend | `docs/specs/picklist-barcode-workflow/sub-spec-2-scan-session-service.md` |
| SS-03 Frontend session flow | `docs/specs/picklist-barcode-workflow/sub-spec-3-frontend-session-flow.md` |
| SS-04 Print pages -- render pick-list barcode | `docs/specs/picklist-barcode-workflow/sub-spec-4-print-barcodes.md` |

Index: `docs/specs/picklist-barcode-workflow/index.md`
