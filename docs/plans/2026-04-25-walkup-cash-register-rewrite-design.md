---
date: 2026-04-25
topic: "Walk-up sales rewrite: cash-register-style scan-into-order with live inventory and pricing"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-25
tags:
  - design
  - walkup-cash-register
  - hampton-hawks-plant-sales
---

# Walk-Up Cash Register Rewrite -- Design

## Summary
Replace the current form-based walk-up flow (search customer -> search plant -> set qty -> override -> submit) with a cash-register flow: open an order shell, scan plants directly into it (each scan = +1 qty, with running total), close the sale. Inventory is decremented at scan time (point-of-sale semantics), pricing comes from `PlantCatalog.Price`, and walk-up inventory protection still gates against preorder reservations. A persisted draft order survives accidental refresh and prevents lost lines.

## Approach Selected
**Approach C: Persisted draft "open ticket" with scan-as-fulfillment.**
The walk-up order is created up front in a new `Draft` state, persists across refreshes (so cashiers can recover from a misclick), accepts barcode scans that add or increment lines on the server, and decrements inventory at the moment of the scan. Closing the sale flips the order from `Draft` to a fully fulfilled `Completed`. No price overrides, no preorder semantics on this path.

**Why C over alternatives:**
- **A (client-only cart, single submit):** rejected -- a single submit at the end means a multi-minute checkout commits all-or-nothing; if the connection blips during submit, the cashier loses the cart and the customer waits. Also doesn't update walk-up availability for other stations during the sale.
- **B (each scan creates a one-line order):** rejected -- multiplies order count by item count, makes reporting messy, and doesn't match how a customer actually checks out (one receipt with N items).
- **C (persisted draft + scan-as-fulfillment):** **selected** -- matches how registers actually work; lines are server-side from the start; inventory is correct in real time; refresh-safe; dovetails with existing `IInventoryProtectionService` which already understands per-plant decrement.

## Architecture

```
FRONTEND (React/Vite)
  WalkUpRegisterPage (NEW, replaces WalkUpNewOrderPage)
    --> creates Draft order (or resumes existing one)
    --> input box: barcode scanner cursor
    --> running ticket display: lines, qty, unit price, line total, grand total
    --> actions: Void Line, Adjust Qty, Customer Info (optional), Close Sale, Cancel Sale
  WalkUpStationHomePage (extended) --> "New Sale" / "Resume Open Tickets"
  appStore --> tracks last open draft per workstation

        | HTTP / ApiResponse<T>
API (.NET 9)
  /api/walkup/draft          POST   create draft order (Status=Draft)
  /api/walkup/draft/{id}/scan POST  scan barcode -> increment/add line + decrement inventory (atomic)
  /api/walkup/draft/{id}/lines/{lineId}  PATCH  adjust qty (admin pin if reduce after fulfill or exceed)
  /api/walkup/draft/{id}/lines/{lineId}  DELETE  void line (admin pin), restores inventory
  /api/walkup/draft/{id}/close POST   finalize sale -> Status=Completed
  /api/walkup/draft/{id}/cancel POST  void entire draft (admin pin), restores inventory for any scanned lines
  /api/walkup/draft/open       GET    list open drafts (resume)

  IWalkUpRegisterService (NEW)
    CreateDraftAsync, ScanIntoDraftAsync, AdjustLineAsync, VoidLineAsync, CloseDraftAsync, CancelDraftAsync, GetOpenDraftsAsync
  IInventoryProtectionService (extended) -- new "register-mode" decrement that works the same way fulfillment does
  Existing IFulfillmentService is NOT used directly (different transaction shape -- decrement on scan, not on a separately tracked fulfillment event)
        | EF Core 9 (transactions + row locks)
POSTGRES 16
  Order (extended) -- add Draft to OrderStatus enum
  OrderLine -- unchanged shape; QtyOrdered = QtyFulfilled at all times for walk-up draft lines
  Inventory -- existing; decremented atomically per scan
  AdminAction -- void/cancel actions logged here
```

**Crucial preservation:**
- Preorder walk-up availability math is preserved: `AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)`. The scan path validates against this same calculation; the only difference is that it decrements `Inventory.OnHandQty` (mirroring how a successful fulfillment of a preorder does today).
- All existing preorder flows (`/api/orders/...`, pickup scan, fulfillment service) are untouched.
- The current form-based walk-up endpoints stay deprecated but operational for one release window so the kiosk can still fall back if the register UI has issues at sale day.

## Components

**Backend:**
- `OrderStatus` enum gains `Draft`. Existing global query filters and reports must opt in or out of including Drafts (default: exclude from sales reports until closed; include in active-station reports).
- `IWalkUpRegisterService` (NEW):
  - `CreateDraftAsync(workstationName, optionalCustomerId)` -- inserts an `Order` with `Status=Draft`, `IsWalkUp=true`, and an auto-generated `OrderNumber` of the form `WLK-DRAFT-{n}` (renamed to `WLK-{n}` on close).
  - `ScanIntoDraftAsync(orderId, barcode, qtyDelta=+1)` -- in a single transaction:
    1. `SELECT FOR UPDATE` the matching plant by barcode
    2. `SELECT FOR UPDATE` the existing line on this draft for that plant (or insert)
    3. Validate against `IInventoryProtectionService.ValidateWalkupLineAsync(plantId, newQty)` (same protection used today)
    4. `UPDATE Inventory SET OnHandQty = OnHandQty - 1` (only if qtyDelta > 0)
    5. Update line: `QtyOrdered += qtyDelta`, `QtyFulfilled += qtyDelta` (always equal for walk-up draft)
    6. Commit
  - `AdjustLineAsync(orderId, lineId, newQty, adminPin, reason)` -- if newQty < current, restore inventory; if exceeds protection limit, require admin pin.
  - `VoidLineAsync(orderId, lineId, adminPin, reason)` -- restores inventory equal to the line's `QtyFulfilled`, logs `AdminAction`, soft-deletes the line.
  - `CloseDraftAsync(orderId, paymentMethod, amountTendered)` -- validates >=1 line, computes grand total from `PlantCatalog.Price * QtyFulfilled`, stamps `Order.Status = Completed`, optionally records payment metadata (see open question), reissues a customer-facing `OrderNumber` if needed.
  - `CancelDraftAsync(orderId, adminPin, reason)` -- restores inventory for every line, soft-deletes the order, logs `AdminAction`.
  - `GetOpenDraftsAsync(workstationName)` -- returns drafts not closed/cancelled.
- `IInventoryProtectionService` (extended): a small helper that combines availability check with the existing walk-up math; no semantic change.
- `OrderResponse` DTO -- adds `Status=Draft` mapping; adds `LineUnitPrice` and `LineTotal` computed fields for register display; adds `GrandTotal`. (DTO already returns `OrderLine` rows; we surface price.)

**Frontend:**
- `WalkUpRegisterPage` (NEW): replaces `WalkUpNewOrderPage`.
  - Top: workstation/cashier label + draft id + total customer count for the day.
  - Center: large barcode input (autofocused, sticks).
  - Below input: ticket table -- plant name, SKU, unit price, qty, line total, void button.
  - Right rail: grand total in large type, "Close Sale" big button, "Cancel Sale" small.
  - Optional collapsible customer panel (search/select/create -- reused components from existing walk-up).
- `WalkUpStationHomePage` (extended): "New Sale" + "Open Tickets" list (resume any draft).
- The existing `WalkUpNewOrderPage` remains accessible for one release window via a feature flag/setting `walkupRegisterEnabled` (default true once shipped); after one sale cycle, removed.

## Data Flow

### Open ticket
```
Cashier -> Station Home -> "New Sale"
  -> POST /api/walkup/draft { workstationName }
  -> ApiResponse<OrderResponse{ status:Draft, lines:[], grandTotal:0 }>
  -> Frontend stores draftId in component state + appStore (so refresh resumes)
```

### Scan a plant
```
Scanner emits barcode "PL-001234"
  -> POST /api/walkup/draft/{id}/scan { barcode:"PL-001234", qtyDelta:1 }

Backend (single transaction):
  BeginTransactionAsync()
    plant = SELECT * FROM PlantCatalog WHERE Barcode=@b FOR UPDATE
    if not found OR not active: throw ValidationException
    line = SELECT * FROM OrderLines WHERE OrderId=@o AND PlantCatalogId=plant.Id AND DeletedAt IS NULL FOR UPDATE
    newQty = (line?.QtyOrdered ?? 0) + 1
    available = OnHandQty - SUM(preorder unfulfilled, excluding this draft) - existing draft qty
    if newQty > available: throw ValidationException("walk-up limit reached") -- no auto override; cashier may call admin
    if line == null: INSERT OrderLine (QtyOrdered=1, QtyFulfilled=1)
    else: UPDATE OrderLine SET QtyOrdered=QtyOrdered+1, QtyFulfilled=QtyFulfilled+1
    UPDATE Inventory SET OnHandQty = OnHandQty - 1 WHERE PlantCatalogId=plant.Id
  Commit
  Return ApiResponse<OrderResponse> with refreshed lines and grandTotal
```

### Adjust qty / void line / cancel sale
- All require admin pin if they reduce a line below current `QtyFulfilled` value or void; restored inventory is incremented in the same transaction; `AdminAction` row written.

### Close sale
```
Cashier clicks "Close Sale"
  -> POST /api/walkup/draft/{id}/close { paymentMethod:"Cash"|"Card"|"Check", amountTendered:42.00 }
Backend (single transaction):
  validate >=1 line
  Order.Status = Completed
  Order.OrderNumber stays "WLK-{n}" (no rename needed since we never exposed Draft to receipts)
  optional Payment record (open question)
  Commit
Receipt renders client-side from response (or links to existing print page).
```

### Refresh-safe resume
```
Page reload -> appStore reads cached draftId -> GET /api/walkup/draft/{id}
  if status==Draft: resume in-place
  else: clear local draftId, return to station home
```

### Inventory protection vs preorder availability
The scan path uses the **same** computation as today's `ValidateWalkupLineAsync`: `OnHandQty - SUM(unfulfilled preorder qty)` excluding this draft's existing qty. The only difference vs preorder fulfillment: scan decrements `OnHandQty` immediately, so subsequent walk-up scans at other stations see the lower number live (preventing oversell across cashiers).

## Error Handling

- **Barcode unknown:** API returns 422 with `errors.barcode = "Unknown barcode"`. UI surfaces as a transient red banner; input clears; cursor stays focused.
- **Inactive plant:** treat as unknown (don't allow scanning into a sale).
- **Walk-up limit reached:** 422 with descriptive message including current available count. UI shows "Out of stock for walk-up." Admin override available via "Manager Override" button which calls `AdjustLineAsync` with admin pin (recorded in `AdminAction` and flips `Order.HasIssue=true`).
- **Concurrent scan from another station:** row-level lock + recompute serializes; whichever scan loses sees an updated availability and gets rejected if it would overdraw.
- **Network blip mid-scan:** request times out client-side; UI marks the last scan as "pending verification"; on next poll/refresh of the draft, server state is authoritative -- duplicate scan IDs prevent double-decrement (see open question on idempotency keys).
- **Refresh during draft:** appStore-cached draftId allows resume; if the user closes the tab entirely, the draft persists server-side and is recoverable from "Open Tickets" list.
- **Close with zero lines:** validation rejects with clear message.
- **Inventory drift on cancel:** restoring inventory is a separate transaction commit; if it crashes mid-way, an `AdminAction` row records the inconsistency for manual reconciliation. Risk surface here is low because each restore is per-line and per-plant.
- **Reports during sale:** reports filter `Status != Draft` by default so live drafts don't poison sales numbers; "Active Drafts" is a separate dashboard widget.

## Success Criteria
- A cashier can run a sale start-to-finish using only the scanner + a "Close Sale" click. Customer info is optional and not required for the happy path.
- Each scan immediately reflects in `Inventory.OnHandQty` so other concurrent stations cannot oversell.
- A grand total is visible on screen at all times, computed from `PlantCatalog.Price * QtyFulfilled`.
- A scan that exceeds walk-up availability is rejected with a clear message and the cashier can request an admin override.
- A page reload mid-sale resumes the draft with all scanned lines intact.
- Closing the sale produces a `Completed` order indistinguishable from preorder-completed orders for downstream reporting (subject to status filter), with `IsWalkUp=true` retained.
- Sale-day throughput target: a 10-item walk-up sale completes in under 60 seconds from "New Sale" click to "Close Sale" success (assumes scanner-driven, no customer info entry).

## Exclusions
- Payment processing (no card terminal integration). `paymentMethod` and `amountTendered` are recorded as metadata; cash drawer + tendering math is operator-managed.
- Receipt printer drivers (use existing print infrastructure for now; thermal receipt format is a stretch goal).
- Loyalty / discount codes / coupons / multi-rate pricing.
- Refund flow after `Close Sale`. Out of scope -- handled today by admin order edit + manual inventory adjustment.
- Tax calculation (assumed tax-exempt fundraiser).
- Multi-currency, partial returns, voiding closed sales.
- Replacement of preorder walk-up endpoints; this design is additive. Old endpoints stay one cycle for fallback.

## Open Questions
- **Idempotency key for scans.** A flaky network might cause the cashier to re-scan the same barcode after a timeout, double-decrementing. Recommended: client generates a per-scan UUID, server enforces uniqueness on `(orderId, scanId)`. Spec to specify.
- **Payment metadata model.** Add a separate `Payment` entity, or just `PaymentMethod`/`AmountTendered` columns on `Order`? Recommendation for simplicity: two columns on `Order` (no payment entity); revisit if multi-payment-per-order needed later.
- **Receipt format.** Browser print of an HTML page is fine for v1. Thermal receipt printer can be a follow-up.
- **OrderNumber convention.** Keep `WLK-{n}` for both draft and completed (no rename) vs. `WLK-DRAFT-{n}` -> rename on close. Recommendation: keep `WLK-{n}` from creation -- simpler and the order already has `Status=Draft` to disambiguate.
- **Customer record requirement.** For walk-up sales, customer info is fully optional. The order's `CustomerId` may be a synthetic "Walk-Up Anonymous" customer per workstation, or nullable. Recommendation: make `Order.CustomerId` nullable for walk-up only and adjust EF config accordingly. (Current schema requires CustomerId.)

## Approaches Considered
- **A: Client-only cart, single submit at end.** Familiar form pattern. Rejected -- inventory not decremented during sale, lossy on disconnect, multiple cashiers can oversell.
- **B: Each scan = its own one-line order.** Reporting nightmare; doesn't match real cashier UX (one receipt, many items). Rejected.
- **C: Persisted draft + scan-as-fulfillment.** **Selected.** Mirrors register UX, refresh-safe, real-time inventory accuracy, integrates cleanly with existing inventory protection.

## Commander's Intent
**Desired End State:**
- Cashier opens "New Sale" -> server creates an `Order` with `Status=Draft`, `IsWalkUp=true`, returns the draft id; client navigates to `WalkUpRegisterPage`.
- Cashier scans plant tags; each scan increments a server-side `OrderLine` (or inserts one), decrements `Inventory.OnHandQty` atomically, and the running grand total updates from `PlantCatalog.Price * QtyFulfilled`.
- Inventory protection (`AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)` excluding this draft) gates each scan; over-limit returns a clear validation error and offers a "Manager Override" which records an `AdminAction`.
- Cashier clicks "Close Sale" -> server flips `Status` to `Completed`, persists optional `PaymentMethod`/`AmountTendered`, and returns the final order for receipt rendering.
- Page reload mid-sale resumes the same draft via cached id; closing the tab leaves the draft recoverable from "Open Tickets".
- All existing preorder, pickup, fulfillment, and reporting flows continue to work unchanged.

**Purpose:** The current form-based walk-up flow is broken (per user) and slows checkouts because the cashier cannot work scan-first. A cash-register UX matches how operators actually run a sale day, makes inventory accurate in real time across stations (preventing oversell across cashiers), and removes the multi-minute risk of the all-or-nothing single-submit pattern. A scan-driven 10-item walk-up sale should complete in under 60 seconds.

**Constraints (MUST):**
- MUST preserve walk-up inventory protection math: `AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)` excluding the current draft. The scan path validates against this before decrement.
- MUST use `BeginTransactionAsync()` + `SELECT ... FOR UPDATE` per scan (matching `FulfillmentService` pattern) so two concurrent stations cannot oversell.
- Each successful scan MUST atomically: (a) update/insert `OrderLine`, (b) decrement `Inventory.OnHandQty`, (c) commit -- all in one transaction.
- Idempotency: a client-generated scan id MUST be accepted and de-duplicated server-side so a retry after timeout cannot double-decrement.
- All endpoints MUST return `ApiResponse<T>` envelope. All admin operations (void line, cancel sale, override) MUST be `[RequiresAdminPin]` and MUST log `AdminAction`.
- `OrderStatus.Draft` MUST be added to the enum and to soft-delete / report query filters as documented (default: drafts excluded from sales reports).
- MUST NOT break existing `/api/walkup/orders/...` endpoints during the migration cycle; old `WalkUpNewOrderPage` stays accessible for one release.
- Order numbering MUST stay `WLK-{n}` (no rename on close).

**Constraints (MUST NOT):**
- MUST NOT replace the preorder fulfillment flow.
- MUST NOT process payments via card terminal or hold sensitive payment info.
- MUST NOT introduce per-line price overrides; price is `PlantCatalog.Price` only.
- MUST NOT auto-cancel drafts on inactivity without admin action; `ExpireStaleAsync` housekeeping is allowed but must be conservative (default 24h+).
- MUST NOT include `Status=Draft` orders in any sales/revenue report by default.

**Freedoms (the implementing agent MAY):**
- MAY pick the visual layout of the register screen (left ticket / right total vs. top input / bottom ticket) so long as the barcode input is the dominant focal element and the grand total is visible without scrolling.
- MAY implement the inline customer-info panel as a side panel, modal, or expandable accordion.
- MAY choose the approach for `paymentMethod` / `amountTendered` capture (single fields vs. small modal at close).
- MAY choose whether `Order.CustomerId` becomes nullable globally OR is satisfied by a per-workstation "Walk-Up Anonymous" Customer row. Recommendation: nullable for walk-up only.
- MAY reuse parts of the existing `WalkUpNewOrderPage` (customer search, plant search) where they fit; the goal is a register-style UX, not preserving specific components.

## Execution Guidance
**Observe (signals to monitor during implementation):**
- `dotnet build` and `dotnet test` pass per `forge-project.json`.
- New EF migration applies cleanly via `dotnet ef database update` against the docker-compose Postgres.
- `npm run build` clean; no React render warnings on the register page during a 50-scan rapid burst.
- Inventory invariant: at the end of any scan flow, `OnHandQty + SUM(QtyFulfilled across draft+open orders)` is unchanged for any plant id (i.e., decrement-on-scan + restore-on-void preserves total quantity).

**Orient (codebase conventions to maintain):**
- Service interface in `Core/Interfaces/IWalkUpRegisterService.cs`; implementation in `Infrastructure/Services/WalkUpRegisterService.cs`. Register in `Program.cs`.
- New entity classes in `Core/Models/`; one `IEntityTypeConfiguration<T>` per new entity in `Infrastructure/Data/Configurations/`. Walk-up draft uses existing `Order` entity; only the `OrderStatus` enum gains `Draft`.
- Migrations: `dotnet ef migrations add AddOrderStatusDraft --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api` (one migration per logical schema change).
- Frontend page lives at `web/src/pages/walkup/WalkUpRegisterPage.tsx`. New API client at `web/src/api/walkupRegister.ts`. Mirror existing typed client patterns.
- Receipts: defer to existing print pages under `web/src/pages/print/`. Do NOT add a thermal receipt driver.
- All new tests in `tests/HamptonHawksPlantSales.Tests/` covering: scan idempotency, concurrent scan from two simulated stations, walk-up limit enforcement, override flow, void-line inventory restore, cancel-draft inventory restore, close with zero lines (rejected), close with at least one line (Completed).

**Escalate when:**
- Making `Order.CustomerId` nullable globally is required (vs. per-walk-up only). This affects existing reads.
- The chosen idempotency mechanism would require a new table; if a column on `OrderLine` (e.g., `LastScanIdempotencyKey`) suffices, prefer that.
- Performance on the production-target mini-PC (i7 / 32 GB) shows scan latency >250ms under 10 concurrent stations.
- Removal of the old form-based walk-up endpoints is requested ahead of one full sale cycle of fallback.

**Shortcuts (apply without deliberation, derived from existing code):**
- For barcode resolution: copy `FulfillmentService.ScanBarcodeAsync` lookup pattern (`SELECT ... FOR UPDATE` on `PlantCatalog`).
- For inventory decrement: match `InventoryService` write pattern; never bypass through raw SQL outside the service layer unless the existing pattern uses raw SQL (it does for row locks).
- For walk-up validation: reuse `IInventoryProtectionService.ValidateWalkupLineAsync` (extend if necessary; do NOT re-implement the math).
- For admin pin handling: copy `[RequiresAdminPin]` usage from existing override endpoints in `WalkUpController`. Reason via `HttpContext.Items["AdminReason"]`.
- For audit: copy `IAdminService.LogActionAsync` calls from `WalkUpService.AddWalkUpLineAsync`.
- For React draft persistence: store `draftId` in `appStore` (Zustand) keyed by `workstationName`. Hydrate on mount.

## Decision Authority
**Agent decides autonomously:**
- File/folder placement; component decomposition on the register page; Zustand store shape for draft tracking.
- Idempotency key generation (recommend `crypto.randomUUID()`).
- Inline UX copy and labels.
- Test case design and grouping.
- Internal helper method naming.

**Agent recommends, human approves:**
- `Order.CustomerId` nullable scope (walk-up only vs. global).
- `paymentMethod` / `amountTendered` modeling -- two columns on `Order` vs. separate `Payment` entity (recommend two columns).
- Default `ExpiresAt` for drafts (recommend 24h or none — drafts persist until cancelled/closed).
- Whether to soft-deprecate `/api/walkup/orders/...` endpoints in this PR or in a follow-up.
- Whether to add a new global query filter for `Status=Draft` exclusion in reports vs. a per-query `where` clause (recommend explicit per-query for clarity).

**Human decides:**
- Removal timing of the legacy `WalkUpNewOrderPage`.
- Receipt format and printer integration (deferred).
- Refund/void-after-close flow design (out of scope here).
- Whether to expose payment metadata in any user-facing report.

## War-Game Results
**Most likely failure -- duplicate decrement on scanner double-fire or network retry.**
Scanner emits the same code twice within milliseconds; or the client retries a request after a timeout. Mitigation: client-generated idempotency key; server enforces uniqueness via a column on `OrderLine` (e.g., `LastScanIdempotencyKey`) updated atomically inside the transaction. The first scan with a given key wins; the second is a no-op returning the same result. Spec MUST verify with a test that fires two parallel requests with the same key and asserts a single decrement.

**Scale stress -- 10 cashier stations + 50 customers in line.**
Scenario: ~5 scans/sec across the system. Each scan holds a row lock on the plant id and on the draft's order line for that plant. Different plants do not contend; same plant across stations serializes. Worst case: a popular plant scanned by all 10 cashiers simultaneously serializes through the lock; given short transaction, sub-100ms per lock release should sustain throughput. The `/forge` spec MUST include a load test that simulates 10 concurrent stations scanning a mix of 50 plants for 60 seconds.

**Dependency disruption -- Inventory drift after partial transaction failure.**
Scenario: a void-line transaction commits the line soft-delete but the inventory restore fails (or vice versa). Mitigation: both writes happen inside the same transaction; if the transaction fails, neither commits. The risk surface is therefore very small but if it materializes, an `AdminAction` row records the inconsistency; reconciliation is via existing inventory adjustment. Recovery path: existing `InventoryAdjustment` entity covers the manual correction.

**6-month maintenance assessment.**
A new contributor reading this design plus the resulting spec should be able to: trace any single endpoint from controller -> service -> persistence; explain why drafts are excluded from sales reports; identify the idempotency mechanism; and run the walk-up register locally via `start.bat`. The phased migration (old endpoints stay one cycle) is documented; removal is a follow-up task. Test coverage for concurrency invariants is the primary defense against regression.

## Evaluation Metadata
- Evaluated: 2026-04-25
- Cynefin Domain: Complicated -- known patterns (transactional decrement, idempotency keys, draft state) but multiple valid approaches and serious concurrency considerations.
- Critical Gaps Found: 0
- Important Gaps Found: 0
- Suggestions: 0
- Framework layers added: Commander's Intent, Execution Guidance, Decision Authority, War-Game Results

## Next Steps
- [ ] Auto-chain: `/forge` -> `/forge-prep` -> `/forge-red-team` (master + each phase)
- [ ] Resolve open questions during the `/forge` spec phase
- [ ] Decide how/when to remove old `WalkUpNewOrderPage` and `/api/walkup/orders/...` endpoints (one cycle out)
