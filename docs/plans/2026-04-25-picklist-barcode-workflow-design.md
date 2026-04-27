---
date: 2026-04-25
topic: "Pick-list barcode workflow: scan a printed pick-list to load all of a student's or customer's plants into one scan queue"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-25
tags:
  - design
  - picklist-barcode-workflow
  - hampton-hawks-plant-sales
---

# Pick-List Barcode Workflow -- Design

## Summary
Today, the pickup scan screen is per-order: cashier scans an order sheet barcode (`OR-...`), then scans plants for that one order. With many customers placing multiple orders -- or multiple students filling one buyer's request -- this is awkward. This design adds two new pick-list barcode types (`PLB-` for buyer/customer pick lists, `PLS-` for student/seller pick lists), prints them on existing pick-list summary sheets, and teaches the scan workflow to load an aggregate scan queue across all related orders. A stretch path lets cashiers scan multiple plain `OR-` barcodes in succession to build the same aggregate ad-hoc.

## Approach Selected
**Approach B: Server-computed Scan Session with new pick-list barcode prefixes.**
Pick-list barcodes are stable identifiers tied to a customer or seller (printed on the existing summary sheets). Scanning one creates a server-side `ScanSession` that aggregates `OrderLine` rows from all open orders for that entity. The scan screen then operates against the session; each plant scan resolves to the right `OrderLine` across orders. Sessions are short-lived (auto-expire), persisted (refresh-safe), and write-tracked (every scan = same fulfillment events as today, just attributed to a session as well as an order).

**Why B over alternatives:**
- **A (client-only aggregation):** Client fetches all orders for the matched entity and tracks queue locally. Rejected -- doesn't survive refresh, doesn't coordinate across cashiers (two cashiers could scan the same plant), and aggregating fulfillment correctness in the browser is fragile.
- **B (server-computed scan session):** **Selected.** Single source of truth; reuses existing `IFulfillmentService` per-line concurrency (row locks per order line); refresh-safe; allows ad-hoc multi-order via the same session abstraction (deferred mode toggle).
- **C (one combined "super-order"):** Rejected -- corrupts order/customer accounting; reports break; refunds become impossible to attribute.

## Architecture

```
PRINT
  PrintCheatsheetPickup / PrintSellerPacketPage / new pick-list summary sheets
    --> render barcode `PLB-{customerId-shortcode}` (buyer pick list)
    --> render barcode `PLS-{sellerId-shortcode}` (student pick list)

FRONTEND (React/Vite)
  PickupLookupPage (extended)
    --> recognizes PLB-/PLS- prefix and POSTs to /api/scan-sessions to create one
    --> navigates to /pickup/session/{sessionId}
  PickupScanSessionPage (NEW, sibling of PickupScanPage)
    --> shows aggregated queue: orders involved + pending lines + already-scanned
    --> reuses ScanInput, ScanFeedbackBanner, ScanHistoryList, useScanWorkflow (extended)
    --> "Add another order" button -- scans an OR-/PLB-/PLS- to expand the session (stretch / deferred)

        | HTTP / ApiResponse<T>
API (.NET 9)
  /api/scan-sessions                 POST   create from picklist barcode (or list of order ids)
  /api/scan-sessions/{id}            GET    fetch session + aggregated lines
  /api/scan-sessions/{id}/scan       POST   scan plant barcode -> route to first matching pending line
  /api/scan-sessions/{id}/expand     POST   add an order/picklist to an existing session
  /api/scan-sessions/{id}/close      POST   close session (does NOT auto-complete orders -- that's still per-order)
  /api/scan-sessions/expire-stale    internal/scheduled (housekeeping)

  IScanSessionService (NEW)
    CreateFromPicklistAsync, GetAsync, ScanInSessionAsync, ExpandAsync, CloseAsync, ExpireStaleAsync
  IFulfillmentService (existing) -- delegated to per-line; ScanSession just routes

        | EF Core 9 (transactions + row locks)
POSTGRES 16
  ScanSession (NEW): Id, CreatedAt, ClosedAt, ExpiresAt, WorkstationName, EntityKind (Customer|Seller|AdHoc), EntityId nullable
  ScanSessionMember (NEW): SessionId, OrderId  (one row per included order)
  Order/OrderLine/FulfillmentEvent -- unchanged
  Customer.PicklistBarcode (NEW, generated string); Seller.PicklistBarcode (NEW, generated string)
```

## Components

**Backend:**
- `Customer` model gains `PicklistBarcode` (string, unique, non-null, default-generated `PLB-{8 base32}`); migration backfills existing rows.
- `Seller` model gains `PicklistBarcode` (string, unique, non-null, default-generated `PLS-{8 base32}`).
- `ScanSession` entity (NEW): tracks the session shell.
- `ScanSessionMember` entity (NEW): junction to orders included in the session.
- `IScanSessionService` (NEW):
  - `CreateFromPicklistAsync(string scannedBarcode, string workstationName)`:
    - parses prefix (`PLB-` -> customer; `PLS-` -> seller; otherwise reject -- `OR-` is handled by existing PickupLookupPage)
    - looks up entity by `PicklistBarcode`; finds open orders (`Status in [Open, InProgress]`, `DeletedAt IS NULL`)
    - creates `ScanSession` + `ScanSessionMember` rows
    - returns aggregated session view (lines pending across all member orders)
  - `ScanInSessionAsync(sessionId, plantBarcode)`:
    - in a single transaction:
      1. `SELECT FOR UPDATE` session and its members
      2. find the first pending `OrderLine` matching `PlantCatalog.Barcode` (preferring oldest order, then any deterministic tiebreaker)
      3. delegate to existing fulfillment logic for that line (idempotent, same row-lock contract)
      4. emit `FulfillmentEvent` row as today
    - returns the aggregated session view + result classification (Accepted / NotFound / AlreadyFulfilled / WrongOrder N/A in aggregate / OutOfStock / SaleClosedBlocked)
  - `ExpandAsync(sessionId, scannedBarcode)`: appends additional orders by scanning another `OR-`, `PLB-`, or `PLS-`. (Stretch -- gated by setting; off by default to avoid user confusion.)
  - `CloseAsync(sessionId)`: stamps `ClosedAt`. Does NOT auto-complete underlying orders -- closing an order is still admin-driven via existing `/api/orders/{id}/complete`.
  - `ExpireStaleAsync()`: scheduled hosted service; closes sessions older than N hours (default 4) so they don't pile up.
- `ScanSessionsController` (NEW): standard `[ApiController]` shell, endpoints listed above. Public access (no admin pin) consistent with existing scan flow.

**Frontend:**
- `PickupLookupPage` (extended):
  - When the input value matches `PLB-` or `PLS-` prefix, route to `POST /api/scan-sessions` with `{ scannedBarcode, workstationName }`. On success, `navigate('/pickup/session/{id}')`. Reject `OR-` or freeform input on this code path -- those keep existing behavior.
- `PickupScanSessionPage` (NEW):
  - Header: "Pickup Session for {entityName}" + included orders list (chip per order with status, click to view details).
  - Body: extended `useScanWorkflow` keyed by session id; `ScanInput`, `ScanFeedbackBanner`, `ScanHistoryList`, `ItemsRemainingCounter` reused.
  - Right rail: per-order "Complete Order" buttons (each still admin-pin gated for force-complete, normal complete still requires all lines fulfilled).
  - Footer: "Close Session" (does not complete orders) and "End and return to lookup" (closes session, navigates back).
- `useScanWorkflow` (extended): factor a small adapter so it can target either `/api/orders/{id}/...` or `/api/scan-sessions/{id}/...`. The hook signature stays compatible by adding a `mode: 'order' | 'session'` parameter.
- Print pages (`PrintCheatsheetPickup`, seller packet, etc.) updated to render the new pick-list barcode in the appropriate header. Each entity's barcode is stable across reprints.

## Data Flow

### Print pick-list with embedded barcode
```
Admin prints student summary sheet
  -> PrintSellerPacketPage fetches Seller including PicklistBarcode
  -> Renders Code128 barcode of "PLS-XXXXXXXX"
Same for customer pick lists -> "PLB-XXXXXXXX"
```

### Scan a pick-list at the pickup station
```
Cashier scans paper -> "PLS-A1B2C3D4"
  -> PickupLookupPage detects PLS- prefix
  -> POST /api/scan-sessions { scannedBarcode:"PLS-A1B2C3D4", workstationName:"Pickup-1" }

Backend:
  parse prefix -> kind=Seller
  seller = SELECT FROM Sellers WHERE PicklistBarcode=@b AND DeletedAt IS NULL
  if not found: 404
  orders = SELECT FROM Orders WHERE SellerId=seller.Id
                              AND Status IN (Open, InProgress)
                              AND DeletedAt IS NULL
  if zero orders: 422 with explanatory error
  INSERT ScanSession (...)
  INSERT ScanSessionMember rows (one per order)
  Commit
  Return ApiResponse<ScanSessionResponse> with aggregated lines

Frontend: navigate /pickup/session/{id}
```

### Scan a plant within the session
```
Cashier scans plant tag -> "PL-1234"
  -> POST /api/scan-sessions/{id}/scan { plantBarcode:"PL-1234" }

Backend:
  Begin transaction
    session = SELECT FROM ScanSessions WHERE Id=@s FOR UPDATE
    if ClosedAt != null OR ExpiresAt < now: 410 Gone
    plant = SELECT FROM PlantCatalog WHERE Barcode=@p
    if not found: return Result=NotFound
    candidate lines = SELECT ol.* FROM OrderLines ol
                      JOIN ScanSessionMembers m ON m.OrderId = ol.OrderId
                      JOIN Orders o ON o.Id = ol.OrderId
                      WHERE m.SessionId=@s
                      AND ol.PlantCatalogId=plant.Id
                      AND ol.QtyFulfilled < ol.QtyOrdered
                      AND ol.DeletedAt IS NULL
                      AND o.DeletedAt IS NULL
                      ORDER BY o.CreatedAt ASC, ol.CreatedAt ASC
                      LIMIT 1
                      FOR UPDATE
    if no candidate AND already-fulfilled-line-exists: return AlreadyFulfilled
    if no candidate AND no line for plant: return NotFound (or "wrong picklist" if plant exists in catalog but not in any member order)
    delegate to fulfillment increment (same transaction): QtyFulfilled++
    INSERT FulfillmentEvent
  Commit
  Return aggregated session view + Result=Accepted
```

### Expand session (stretch / off by default)
```
Cashier scans an additional OR-/PLB-/PLS- in session
  -> POST /api/scan-sessions/{id}/expand { scannedBarcode }
  -> resolve barcode kind, append member rows, return refreshed session view
```

### Close session
```
Cashier clicks "End and return"
  -> POST /api/scan-sessions/{id}/close
  -> session.ClosedAt = now
  -> Frontend navigates to /pickup
```

## Error Handling

- **Pick-list barcode unknown** (`PLB-` / `PLS-` not found): 404 with descriptive message; UI shows banner "Pick-list not recognized -- check the print or use order number lookup."
- **Pick-list resolves but no open orders:** 422 with message "All orders for this {customer|student} are already complete." UI offers a link to view the entity's recent orders.
- **Two cashiers run sessions for the same entity:** allowed -- each scan still locks the underlying `OrderLine`. The first scan that fulfills a line wins; second cashier gets `AlreadyFulfilled` for that plant. Document this in the cashier cheatsheet.
- **Plant not in any session order:** result `NotFound` with hint "Plant doesn't belong to any included order. Reset session or use Recover."
- **Stale session:** if `ExpiresAt < now`, return 410 Gone and prompt to start a new session.
- **Session crashed mid-scan:** transaction rollback; existing `FulfillmentEvent` semantics preserve correctness; cashier rescans.
- **Sale closed:** existing block applies -- `SaleClosedBlocked` result, same UX as today.
- **Refresh during session:** session id stored in URL; page reload fetches the session, no work lost.
- **Ad-hoc OR- aggregation conflict:** if user tries to expand with an order whose customer differs and the setting is off, reject with descriptive message.

## Success Criteria
- A cashier scans a printed student pick list barcode and the scan screen loads with all plants from that student's open orders queued up.
- A cashier scans a printed customer pick list barcode and the scan screen loads with all plants from that customer's open orders.
- Per-plant scans within the session correctly attribute fulfillment to the right `OrderLine` across multiple orders.
- A second cashier running a session for the same entity does not double-fulfill any line.
- Sessions auto-expire after a configurable window so stale state does not accumulate.
- Closing a session does not affect underlying orders -- order completion remains per-order via the existing flow.
- The existing per-order scan flow (`/pickup/{orderId}`) is untouched and continues to work.

## Exclusions
- Auto-completing orders when the session ends. Order completion remains an explicit per-order action.
- Multi-station coordination beyond DB row locks (no real-time sync of session state across stations).
- Pick-list barcodes for arbitrary collections (only Customer or Seller in v1; ad-hoc list of orders deferred to expand-mode stretch).
- Modifying the order or its lines from the session view (read-only aggregation; per-order detail still owns edits).
- Receipt/print integration changes beyond rendering the new barcode on existing print pages.
- Live multi-cashier presence indicators ("someone else is scanning these orders") -- defer.

## Open Questions
- **Pick-list barcode rotation policy.** Once printed, the barcode is permanent. Should reissuing a pick list rotate it? Recommendation: stable per entity (do not rotate); the entity itself is the unit of identity, and reprints should resolve to the same session-creation behavior.
- **Session expiry default.** 4 hours feels right for a sale day. Make it a setting (`scanSessionExpiryMinutes`, default 240). Defer to spec.
- **Result classification for aggregate.** "WrongOrder" doesn't apply when N orders are loaded; new result type `NotInSession` may be cleaner. Spec to decide.
- **Walk-up draft orders in sessions.** Walk-up draft orders should NOT be included in pick-list sessions (they are register-flow). Confirm filter excludes `Status=Draft` (covered, but call out in spec).
- **Adoption order.** Should the basic per-order scan keep working after pick-list ships? Yes -- they are complementary. Pick list is for the optimal printed-summary path; per-order is for one-off / ad-hoc / customer without summary.

## Approaches Considered
- **A: Client-only aggregation.** Cashier scans `PLB-`, browser fetches all orders for that customer, tracks queue locally. Rejected -- not refresh-safe, not multi-cashier safe, and pushes correctness logic into the browser.
- **B: Server-computed scan session.** **Selected.** Stable, recoverable, shares existing fulfillment row-lock semantics, supports stretch (ad-hoc expand) cleanly.
- **C: One combined super-order.** Rejected -- breaks accounting and reporting; orders are the unit customers and admins reason about.

## Commander's Intent
**Desired End State:**
- Customers and Sellers each have a `PicklistBarcode` (auto-generated, stable, unique). The existing print pages render this barcode on the appropriate summary sheet.
- A cashier scans `PLB-{customerId}` or `PLS-{sellerId}` at the lookup screen; the system creates a `ScanSession` aggregating all open orders for that entity and navigates to `/pickup/session/{id}`.
- On the session scan page, scanning any plant barcode resolves to the first pending matching `OrderLine` across the included orders and emits a `FulfillmentEvent` with the same correctness guarantees as today's per-order scan.
- Closing a session does NOT auto-complete its orders; per-order completion remains the explicit admin action it is today.
- Existing per-order scan flow continues to work unchanged.

**Purpose:** During the spring sale, customers with multiple orders (or students with stacks of orders) had no efficient way to load their full pick list into a scan queue. Cashiers either flipped between order screens or manually re-scanned each order's barcode. Embedding a pick-list barcode on the printed summary sheet, plus a server-side scan session, lets one paper scan replace many.

**Constraints (MUST):**
- MUST NOT modify or replace the existing per-order scan flow (`/pickup/{orderId}`).
- MUST reuse `IFulfillmentService` semantics inside the session scan endpoint -- no parallel fulfillment paths.
- MUST persist `PicklistBarcode` on `Customer` and `Seller` with backfill for existing rows; barcodes MUST be unique and stable across reprints.
- MUST exclude `Order.Status = Draft` (walk-up draft) from session aggregation.
- MUST honor `Sale Closed` blocks identically to per-order scan.
- All new endpoints MUST return `ApiResponse<T>` envelopes.
- Sessions MUST be persisted (refresh-safe) with an `ExpiresAt` field; stale sessions MUST not block re-creation.
- MUST add new prefix detection in `PickupLookupPage` without removing or weakening the existing `OR-`/order-number path.

**Constraints (MUST NOT):**
- MUST NOT auto-complete orders on session close.
- MUST NOT enable `Expand` (multi-order ad-hoc) by default in v1; gate it behind a setting (default off).
- MUST NOT introduce a new fulfillment event type; reuse the existing one.
- MUST NOT collide with existing barcode prefixes (`OR-` for orders, `PL-` for plants, `WLK-` for walk-up).
- MUST NOT modify or remove the existing `/api/orders/{id}/...` scan/fulfillment endpoints.

**Freedoms (the implementing agent MAY):**
- MAY pick the exact base32 / base36 alphabet and length for barcode codes (recommend Crockford base32, length 8).
- MAY decide between adding a session id column on `FulfillmentEvent` (for trace) vs. linking only via `ScanSessionMember` -- recommend the latter, simpler.
- MAY add an "active session count" widget to admin dashboards if useful.
- MAY render the pick-list barcode inline on existing summary sheets rather than separate cards.

## Execution Guidance
**Observe (signals to monitor during implementation):**
- `dotnet build` / `dotnet test` clean.
- New EF migrations apply via `dotnet ef database update`.
- React build clean; no console warnings on the new session page.
- Tests cover: PLB-/PLS- prefix recognition, session creation with N orders, scan routing across multiple orders, conflict between two cashier sessions for the same entity, expired session rejection, sale-closed block.

**Orient (codebase conventions to maintain):**
- Service interface in `Core/Interfaces/IScanSessionService.cs`; implementation in `Infrastructure/Services/ScanSessionService.cs`.
- New entities `ScanSession` and `ScanSessionMember` in `Core/Models/`; one `IEntityTypeConfiguration<T>` each in `Infrastructure/Data/Configurations/`.
- Customer and Seller column additions via EF migration with backfill (use `MigrationBuilder.Sql` or a runtime hosted-service one-shot if migration scripting is awkward).
- Frontend route `/pickup/session/:id` in the existing router config; page at `web/src/pages/pickup/PickupScanSessionPage.tsx`.
- Hook `useScanWorkflow` should be parameterized to target either `/api/orders/{id}` or `/api/scan-sessions/{id}`; do NOT duplicate the hook.
- Print pages (`PrintCheatsheetPickup`, `PrintSellerPacketPage`) updated to render the new barcode.

**Escalate when:**
- Backfill of existing Customer/Seller barcodes risks producing duplicates with existing `OR-` numbers (verify after generation).
- The chosen length for the random suffix is found to allow >0.001% collision probability across the existing data set.
- A redesign of `useScanWorkflow` would require touching the per-order scan flow contract.
- The session scan path needs a new fulfillment event type (it should not -- escalate if you find a reason).

**Shortcuts (apply without deliberation):**
- For prefix detection: extend the existing `looksLikeOrderNumberLookup` / `normalizeOrderLookupValue` in `web/src/utils/orderLookup.ts` rather than introducing a new util module. Add `looksLikeBuyerPicklist`, `looksLikeStudentPicklist` siblings.
- For aggregation: copy join shape from existing `OrderService.GetByCustomerAsync` for filtering (`Status IN (...)`, `DeletedAt IS NULL`).
- For barcode generation: a small `BarcodeFactory` static helper colocated with the entity configuration; uses `Random.Shared` (sufficient for non-crypto identity).
- For row locking on session scan: `BeginTransactionAsync` + `SELECT FOR UPDATE` on the candidate `OrderLine` (matches `FulfillmentService` pattern).

## Decision Authority
**Agent decides autonomously:**
- Internal model layout for `ScanSession` (columns, indexes).
- Choice of UUID vs. Guid for `ScanSession.Id` (use Guid -- existing convention).
- React route name and component decomposition.
- Test grouping and naming.
- Logging detail level on session creation/scan.

**Agent recommends, human approves:**
- Default session expiry (recommend 240 minutes / 4 hours).
- Whether `Expand` should be exposed in v1 (recommend off; introduce in a follow-up after Quick Wins is in users' hands).
- Naming of the new fulfillment-result classification when no candidate line exists (`NotInSession` recommended).
- Whether to add a `SessionId` foreign key on `FulfillmentEvent` for traceability (recommend yes if cheap; otherwise junction-only).

**Human decides:**
- Whether to make `PicklistBarcode` user-editable in the Customer/Seller edit screen (recommend not in v1).
- Whether to render an "active sessions" widget on a dashboard.
- Adoption order vs. Quick Wins / Walk-up rewrite (user has indicated this ships last).

## War-Game Results
**Most likely failure -- two cashiers run sessions for the same entity simultaneously.**
Scenario: a customer prints two pick lists; two cashiers scan them at different stations. Each gets a session with all of that customer's open orders. The first scan that hits a plant fulfills the line; the second cashier sees `AlreadyFulfilled` for that plant. Mitigation: this is the correct behavior. Document in cashier cheatsheet ("If 'Already Fulfilled' shows up, another cashier scanned that plant. Move on."). Tests cover concurrent fulfill of same `OrderLine` from two sessions.

**Scale stress -- one customer with 30 orders.**
Scenario: a teacher orders for an entire class. Session aggregation may include 30 `OrderLine` rows. Mitigation: query is indexed on `OrderId` and `PlantCatalogId`; no quadratic operations; payload size is bounded.

**Dependency disruption -- backfill of existing entities.**
Scenario: backfill generates a duplicate or fails partway. Mitigation: migration is idempotent (UPSERT semantics on the new column); duplicates are caught by the unique index; failed backfill rolls back the migration. Spec MUST include a backfill verification step.

**6-month maintenance assessment.**
A new contributor reading the design + spec should be able to trace `PLB-XXXX` -> Customer -> ScanSession -> ScanSessionMembers -> aggregated lines -> per-line fulfillment via existing service. The boundary "session is read-only aggregator; fulfillment is the existing flow" is the key invariant; the spec must restate it prominently.

## Evaluation Metadata
- Evaluated: 2026-04-25
- Cynefin Domain: Complicated -- novel UX surface, but underlying mechanics (sessions, aggregation, row-locked fulfillment) are known patterns.
- Critical Gaps Found: 0
- Important Gaps Found: 0
- Suggestions: 0
- Framework layers added: Commander's Intent, Execution Guidance, Decision Authority, War-Game Results

## Next Steps
- [ ] Auto-chain: `/forge` -> `/forge-prep` -> `/forge-red-team` (master + each phase)
- [ ] Confirm prefix scheme (`PLB-`/`PLS-`) doesn't collide with any existing barcode encoding (manually verify against current `OR-`, `PL-`, `WLK-` prefixes)
- [ ] User flagged this is the lower-priority of the three -- ship after Quick Wins is in users' hands
