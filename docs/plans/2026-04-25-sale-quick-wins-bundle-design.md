---
date: 2026-04-25
topic: "Post-sale quick wins bundle: scan UX, orders bulk actions, report expansion"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-25
tags:
  - design
  - sale-quick-wins-bundle
  - hampton-hawks-plant-sales
---

# Sale Quick Wins Bundle -- Design

## Summary
A phased polish bundle informed by the spring sale: configurable scanner tunables and scan-screen UX fixes (Phase 1), Orders-page bulk actions for status recovery (Phase 2), and per-student / per-buyer sales reports (Phase 3). One coherent design that ships in three independent waves so sale-critical workflow improvements can land without waiting for reports.

## Approach Selected
**Approach C: Single design, phased execution.** One design doc with three phases that each ship as their own PR. Settings-tunable foundation underpins Phase 1; Orders bulk actions are isolated to the orders surface; reports extend the existing `IReportsService` / `ReportsController` without touching either. Phases are dependency-ordered but otherwise independent.

## Architecture

```
FRONTEND (React/Vite)
  PickupLookupPage   --> reads settings.pickupSearchDebounceMs + auto-jump mode
  PickupScanPage     --> multi-scan loop + post-complete redirect with focus
  OrdersListPage     --> sortable columns + row-select + bulk-action toolbar
  ReportsPage        --> links to new sub-reports
  reports/SalesBySellerPage     (NEW)
  reports/SalesByCustomerPage   (NEW)
  reports/SalesByPlantPage      (NEW, optional)
  SettingsPage       --> new "Scanner Tuning" section
  appStore (Zustand) --> settings cached on load (existing path)
        | HTTP / ApiResponse<T>
API (.NET 9)
  /api/settings                     (extended: tunable fields)
  /api/orders/bulk-complete         (NEW, [RequiresAdminPin])
  /api/orders/bulk-status           (NEW, [RequiresAdminPin])
  /api/reports/sales-by-seller      (NEW)
  /api/reports/sales-by-customer    (NEW)
  /api/reports/sales-by-plant       (NEW, optional)
  ISettingsService  (extended)
  IOrderService     (new bulk methods)
  IReportsService   (new aggregate queries)
        | EF Core 9 (transactions + row locks)
POSTGRES 16
  AppSettings   (extended schema -- new tunable fields)
  Orders / OrderLines / PlantCatalog / Sellers / Customers (existing)
```

**Phase boundaries (each = its own PR):**
- **Phase 1 -- Settings + Scan UX:** AppSettings entity + DTO, `/api/settings`, `appStore`, `SearchBar`, `PickupLookupPage`, `PickupScanPage`, `SettingsPage`. No order/report changes.
- **Phase 2 -- Orders Bulk Actions:** `IOrderService` (bulk methods), `OrdersController`, `OrdersListPage`. No settings/reports changes.
- **Phase 3 -- Reports Expansion:** `IReportsService`, `ReportsController`, new `reports/*` pages. No settings/orders changes.

**Architectural principles preserved:**
- Every new endpoint returns `ApiResponse<T>` (`success`, `data`, `errors`).
- Bulk operations use `BeginTransactionAsync()` + `SELECT ... FOR UPDATE` row locks per existing scan-fulfillment pattern.
- Status-altering bulk endpoints gated by `[RequiresAdminPin]`; reason captured via `X-Admin-Reason` and persisted in `AdminAction`.
- All new settings fields default to current hardcoded values -- no behavior change unless an admin opts in.
- Soft-delete query filters apply to all new reads (`includeDeleted=true` query param available where the existing pattern allows it).

## Components

### Phase 1 -- Settings + Scan UX

**Backend:**
- `AppSettings` entity (extended): add `PickupSearchDebounceMs` (int, default 120, range 50-500), `PickupAutoJumpMode` (enum: `ExactMatchOnly` | `BestMatchWhenSingle`, default `BestMatchWhenSingle`), `PickupMultiScanEnabled` (bool, default true). Migration adds nullable columns with server-default values, then non-null after backfill.
- `SettingsResponse` / `UpdateSettingsRequest` DTOs (extended): expose new fields. New `UpdateScannerTuningRequest` DTO with FluentValidation rules (range checks).
- `ISettingsService.UpdateScannerTuningAsync(...)` (NEW) and an extended `GetAsync()` returning the full settings shape. *Owns:* read/write of tunables. *Does NOT own:* applying them.
- `SettingsController` (extended): new `PUT /api/settings/scanner-tuning` endpoint. Returns updated `SettingsResponse` envelope.

**Frontend:**
- `SettingsPage` (extended): new "Scanner Tuning" admin-only section with debounce input (numeric, 50-500), auto-jump-mode dropdown, multi-scan toggle. Save button calls `settingsApi.updateScannerTuning(...)`.
- `appStore`: extends the cached settings shape; `fetchSettings()` already exists.
- `SearchBar` consumer updated -- `PickupLookupPage` reads `settings.pickupSearchDebounceMs` from store and passes as the `debounceMs` prop (currently hard-coded 120).
- `PickupLookupPage` (modified): replace the `looksLikeOrderNumberLookup` outer gate with the configured `pickupAutoJumpMode`. When `BestMatchWhenSingle`, navigate to scan screen on any single exact `orderNumber` or `barcode` match.
- `PickupScanPage` (modified):
  - **Multi-scan loop:** input stays focused after each successful scan; success feedback renders inline (toast row that auto-dismisses), no modal block; the next scan is accepted while the row is still visible. Sequential awaits prevent races.
  - **Post-complete redirect:** on `POST /api/orders/{id}/complete` success, `navigate('/pickup')`. Existing `PickupLookupPage` mount effect already focuses the search input.
  - **Touch-friendly action layout:** the "Complete Order" button (and other primary actions: Manual Fulfill, Undo Last Scan, Recover) are hoisted near the barcode/SKU input so they sit above-the-fold (no scroll required) on the 1024x768 touchscreen POS terminals. Buttons use a shared touch-friendly class with min hit target 44x44 CSS px and comfortable padding. The volunteers used the touchscreens heavily during the spring sale; reducing scroll-and-click friction is the primary win here.

### Phase 2 -- Orders Bulk Actions

**Backend:**
- `IOrderService.BulkCompleteAsync(IReadOnlyList<Guid> ids, string reason)` (NEW): per-order, in a single transaction, `SELECT FOR UPDATE` the order + its lines; if all lines fulfilled (`QtyFulfilled >= QtyOrdered`), `UPDATE` status to `Completed` and append `AdminAction`; otherwise mark skipped. Returns `BulkOperationResult` with per-order outcome.
- `IOrderService.BulkSetStatusAsync(IReadOnlyList<Guid> ids, OrderStatus targetStatus, string reason)` (NEW): admin-pin path; sets status without eligibility gate; logs `AdminAction` per order.
- `OrdersController` (extended):
  - `POST /api/orders/bulk-complete` `[RequiresAdminPin]` -- delegates to `BulkCompleteAsync`.
  - `POST /api/orders/bulk-status` `[RequiresAdminPin]` -- delegates to `BulkSetStatusAsync`.
- Request DTOs: `BulkCompleteOrdersRequest { Guid[] OrderIds }`, `BulkSetOrderStatusRequest { Guid[] OrderIds; OrderStatus TargetStatus }`. FluentValidation enforces non-empty array, max 500 items, valid enum.

**Frontend:**
- `OrdersListPage` (extended):
  - Sortable column headers for: `orderNumber`, `customerDisplayName`, `status`, `itemsOrdered`, `itemsFulfilled`, `createdAt`. Click toggles asc/desc; URL search params hold sort state.
  - Row-select checkboxes + select-all in header. Selection state lives in component state.
  - Sticky bulk-action toolbar (visible when >=1 row selected): buttons "Mass Complete" and "Change Status...". Both prompt for admin pin via existing `useAdminAuth` hook; on success show a result modal listing per-order outcome.

### Phase 3 -- Reports Expansion

**Backend:**
- `IReportsService` (extended):
  - `GetSalesBySellerAsync()` -> `List<SalesBySellerRow>` (one row per seller including sellers with zero orders if requested). Columns: `sellerId`, `sellerDisplayName`, `orderCount`, `itemsOrdered`, `itemsFulfilled`, `revenueOrdered`, `revenueFulfilled`.
  - `GetSalesByCustomerAsync()` -> `List<SalesByCustomerRow>` keyed by customer with same shape.
  - `GetSalesByPlantAsync()` -> `List<SalesByPlantRow>` keyed by plant (top-sellers slice).
- `ReportsController` (extended): `GET /api/reports/sales-by-seller`, `GET /api/reports/sales-by-customer`, `GET /api/reports/sales-by-plant`. All public (no admin pin) consistent with existing `/api/reports/`.

**Frontend:**
- `ReportsPage` (extended): new "Sales Breakdowns" card group linking to each sub-report.
- `reports/SalesBySellerPage` (NEW): table with sortable columns, CSV export button (shared utility per existing patterns).
- `reports/SalesByCustomerPage` (NEW): same shape, customer-keyed.
- `reports/SalesByPlantPage` (NEW, optional Phase 3 stretch): plant-keyed.

## Data Flow

### Phase 1: Configurable debounce
```
Admin -> SettingsPage -> settingsApi.updateScannerTuning({pickupSearchDebounceMs:80,...})
       -> PUT /api/settings/scanner-tuning  (admin-pin headers)
       -> ISettingsService -> AppSettings table
On next kiosk load -> appStore.fetchSettings() -> cached
PickupLookupPage reads from store -> SearchBar(debounceMs=80)
```

### Phase 1: Auto-jump (relaxed)
```
Scan input -> SearchBar emits debounced value
PickupLookupPage runs lookup (existing customer + order search)
NEW gate logic:
  if pickupAutoJumpMode == BestMatchWhenSingle:
    if exactly one order matched by orderNumber OR barcode (exact, not partial):
      navigate('/pickup/{orderId}')
  else if pickupAutoJumpMode == ExactMatchOnly:
    keep current looksLikeOrderNumberLookup gate
```
"Barcode not quite matching but search found them" is exactly the `BestMatchWhenSingle` path -- drop the format heuristic but keep the exact-id-or-barcode check.

### Phase 1: Multi-scan loop
```
Scan 1 -> POST /api/pickup/scan -> success
       -> input stays focused, value cleared, inline toast row slides in/out
Scan 2 arrives during inline toast -> queued/serialized
       -> awaited and processed
User clicks Complete Order -> POST /api/orders/{id}/complete
       -> success: navigate('/pickup')
       -> PickupLookupPage mount focuses search input (existing useEffect)
```

### Phase 2: Mass complete
```
User selects N orders -> "Mass Complete" -> confirms count + warning if any unfulfilled
   -> POST /api/orders/bulk-complete { orderIds:[...] }
      headers: X-Admin-Pin, X-Admin-Reason

Backend:
  BeginTransactionAsync()
  For each id (max 500):
    SELECT FOR UPDATE Order + OrderLines
    if all lines fulfilled (QtyFulfilled >= QtyOrdered):
      UPDATE Order.Status = Completed
      INSERT AdminAction { action:"BulkComplete", target:orderId, reason }
      result += { id, outcome:"completed" }
    else:
      result += { id, outcome:"skipped", reason:"unfulfilled lines" }
  Commit
  Return ApiResponse<BulkOperationResult>

Frontend: result modal -- N completed, M skipped (with per-order reasons)
```

### Phase 2: Bulk status change (admin recovery)
Same shape as bulk-complete; accepts arbitrary `targetStatus`. Always logs `AdminAction` with reason. Used to recover stuck in-progress orders.

### Phase 3: Sales by Seller
```
ReportsPage -> "Sales by Seller" -> /reports/sales-by-seller
            -> GET /api/reports/sales-by-seller
Backend SQL (EF Core LINQ equivalent):
  SELECT s.Id, s.DisplayName,
         COUNT(DISTINCT o.Id)                                             AS orderCount,
         COALESCE(SUM(ol.QtyOrdered), 0)                                  AS itemsOrdered,
         COALESCE(SUM(ol.QtyFulfilled), 0)                                AS itemsFulfilled,
         COALESCE(SUM(ol.QtyOrdered * pc.Price), 0)                       AS revenueOrdered,
         COALESCE(SUM(ol.QtyFulfilled * pc.Price), 0)                     AS revenueFulfilled
  FROM Sellers s
  LEFT JOIN Orders o      ON o.SellerId = s.Id      AND o.DeletedAt IS NULL
  LEFT JOIN OrderLines ol ON ol.OrderId = o.Id      AND ol.DeletedAt IS NULL
  LEFT JOIN PlantCatalog pc ON pc.Id = ol.PlantCatalogId
  WHERE s.DeletedAt IS NULL
  GROUP BY s.Id, s.DisplayName
  ORDER BY revenueFulfilled DESC

Returns ApiResponse<List<SalesBySellerRow>>

Frontend: sortable table + CSV export
```

`Sales by Customer` is identical shape but joins `Orders` on `o.CustomerId = c.Id`. `Sales by Plant` aggregates by `pc.Id`.

## Error Handling

### Phase 1 -- Scan UX
- **Tunable out of valid range:** server-side FluentValidation rejects with descriptive `ApiResponse.Fail`. Frontend renders the error inline in the Settings form.
- **Stale settings cache:** existing kiosks won't pick up new tunables until next page load. The Settings form notes "Reload kiosk to apply." Out of scope: live broadcast.
- **Auto-jump false positive:** restricted to single exact `orderNumber`/`barcode` match (not partial customer name). Existing `findExactOrderNumberMatches` enforces; we only remove the outer format gate.
- **Multi-scan racing:** sequential awaits in the input handler -- a scan in flight blocks the next from being submitted; the input is cleared only on success/error response. If true bursts happen, an in-memory queue with max length 5 absorbs and de-duplicates rapid identical scans.
- **Post-complete navigation when offline:** if `/complete` fails, do NOT redirect; show the error in place. Only redirect on success.

### Phase 2 -- Bulk Orders
- **Partial failure in bulk-complete:** per-order result list returned; transaction commits eligible, marks ineligible with reason; UI shows summary. Not all-or-nothing -- one bad order should not block 50 good ones.
- **Concurrent edit during bulk op:** `SELECT FOR UPDATE` per order serializes against scan fulfillment; whichever wins last operates on consistent state. Acceptable last-writer-wins for this admin recovery path.
- **Oversized selection:** UI caps select-all at 500; server validates `OrderIds.Length <= 500`. If admin needs more, paginate.
- **Missing/invalid admin pin:** existing `[RequiresAdminPin]` filter returns 403; UI prompts for pin before sending.
- **Audit:** every bulk operation writes per-order `AdminAction` rows with action type, target, count summary, and reason.

### Phase 3 -- Reports
- **Empty result set:** show "No data" empty state with explanation (sale not started, etc.).
- **Slow query at scale:** with 10 stations and a busy sale, reports may run during peak. Mitigations: queries are read-only, leverage `Order.SellerId` and `OrderLine.OrderId` indexes (verify present), cap result rows in API (default 1000), CSV export bypasses UI render for large sets.
- **Soft-deleted records:** global query filters exclude deleted by default, matching existing patterns. Add `?includeDeleted=true` later if needed.

## Success Criteria
- **Phase 1:** At sale day, scanning a barcode in lookup auto-jumps to the scan screen on a single exact match (orderNumber or barcode), regardless of format heuristic. Debounce is settable from Settings without redeploy. Multi-scan works without Enter between scans. After Complete Order, the operator lands back on lookup with search input focused. The "Complete Order" button (and other primary scan-screen actions) sits above-the-fold near the barcode input on the touchscreen POS terminals, with touch-friendly hit targets (≥44×44 CSS px) so volunteers do not have to scroll.
- **Phase 2:** Orders list columns sort asc/desc. Row selection surfaces a bulk-action toolbar with Mass Complete and Change Status. Admin can recover a batch of stuck in-progress orders in under 60 seconds without per-row hand-edits.
- **Phase 3:** A non-admin user can view "Sales by Student" and "Sales by Buyer" reports showing orders, items ordered, items fulfilled, and revenue (`SUM(QtyFulfilled * Price)` plus `SUM(QtyOrdered * Price)` for variance), sorted by any column, exportable to CSV.

## Exclusions
- Live push of settings changes to running kiosks -- admin reloads the kiosk to apply.
- Per-kiosk setting overrides (global only).
- Multi-order ad-hoc scan aggregation (belongs to the Pick-list Barcode design).
- Walk-up flow changes (separate design: walk-up cash register rewrite).
- Real-time / streaming reports (point-in-time queries only).
- Per-line price overrides (revenue uses `PlantCatalog.Price * OrderLine.QtyFulfilled`).

## Open Questions
- **Index verification:** confirm `Orders.SellerId` and `Orders.CustomerId` are indexed in the current schema. Current EF configurations imply yes; the `/forge` spec should verify and add a migration if not.
- **CSV export utility reuse:** prefer reusing whatever pattern existing print/import flows use for client-side CSV; pick one before implementation.
- **Bulk cap value:** 500 is a starting point. Sale-day traffic may want lower. Spec records the choice and exposes it as a settings tunable in a future phase if needed.

## Approaches Considered
- **Approach A (single bundled PR):** Rejected -- couples scan UX (sale-critical) to reports (no urgency); slows down what matters most.
- **Approach B (two slices: sale-critical + reports):** Reasonable, but the design narrative still requires understanding the whole bundle; a single design with phased delivery captures the same separation while preserving narrative coherence.
- **Approach C (single design, phased execution):** **Selected.** Matches natural dependency order (Settings underpin Scan UX), aligns with existing project patterns (`docs/specs/fixes/011-minor-fixes-bundle.md`, etc.), and lets each phase ship as its own PR.

## Commander's Intent
**Desired End State:** Three independently shippable PRs land in `main`:
1. Phase 1 PR: Settings entity has new `PickupSearchDebounceMs`, `PickupAutoJumpMode`, `PickupMultiScanEnabled` columns; `SettingsPage` renders a "Scanner Tuning" admin section; `PickupLookupPage` consumes the configured debounce and auto-jumps on a single exact `orderNumber`/`barcode` match without the format heuristic gate; `PickupScanPage` accepts back-to-back scans without modal interruption and on Complete Order navigates to `/pickup` with the search input focused.
2. Phase 2 PR: `OrdersListPage` columns sort asc/desc with state in URL params; row checkboxes + select-all surface a sticky bulk-action toolbar; "Mass Complete" and "Change Status..." both call new `/api/orders/bulk-complete` and `/api/orders/bulk-status` endpoints (admin-pin gated, capped at 500 per call) and render a per-order result modal.
3. Phase 3 PR: `IReportsService` exposes `GetSalesBySellerAsync`, `GetSalesByCustomerAsync`, and (optional) `GetSalesByPlantAsync`; `/api/reports/sales-by-seller`, `/api/reports/sales-by-customer`, `/api/reports/sales-by-plant` return `ApiResponse<List<...>>`; new pages under `web/src/pages/reports/` render sortable tables with CSV export.

Each PR is testable end-to-end: build + tests pass; the new pages render without a TypeScript error; the new endpoints respond with the `ApiResponse<T>` envelope shape; admin-pin filter rejects requests missing `X-Admin-Pin`.

**Purpose:** The spring sale ran 5 checkout stations smoothly but exposed three operational paper cuts: (a) the lookup screen sometimes failed to auto-jump on barcode scans, slowing every customer; (b) the operator had to hand-fix orders that should have been completed but were stuck in-progress; (c) reports lacked per-student / per-buyer revenue, blocking quick post-sale reconciliation. Fixing these before the next sale (target ~10 stations) directly increases throughput and reduces the admin recovery cost. Reports unblock post-sale reporting to the school + students.

**Constraints (MUST):**
- Every new endpoint MUST return `ApiResponse<T>` (`success`, `data`, `errors`) via `ApiResponse<T>.Ok(...)` / `ApiResponse<T>.Fail(...)`.
- Status-altering bulk endpoints MUST carry `[RequiresAdminPin]`. The filter reads `X-Admin-Pin` and `X-Admin-Reason`; the reason MUST be persisted in `AdminAction` per existing pattern.
- All new entity columns MUST be added with EF migrations via `dotnet ef migrations add ... --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api`. Default values MUST match current hardcoded behavior so unset rows have no behavior change.
- Bulk operations MUST use `BeginTransactionAsync()` + `SELECT ... FOR UPDATE` per the existing scan-fulfillment pattern in `OrderService` / `FulfillmentService`.
- All new reads MUST honor the existing soft-delete global query filters (`DeletedAt IS NULL`). Use `.IgnoreQueryFilters()` ONLY when the existing `includeDeleted=true` admin pattern requires it.
- Frontend MUST extend the existing `appStore` settings cache and `settingsApi` shape rather than introducing a new state store.
- Sortable Orders columns MUST persist sort state in URL search params (consistent with existing list-page pattern in this project).
- New report pages MUST live under `web/src/pages/reports/` and link from `ReportsPage`.

**Constraints (MUST NOT):**
- MUST NOT introduce any new public API contract that breaks the `ApiResponse<T>` envelope.
- MUST NOT modify the existing per-order scan / fulfillment flow.
- MUST NOT add live-broadcast of settings changes (excluded; admin reload required).
- MUST NOT introduce per-line price overrides — revenue uses `PlantCatalog.Price * OrderLine.QtyFulfilled`.
- MUST NOT cap bulk selection lower than 500 unless build/perf evidence forces it.
- MUST NOT hand-roll JSON serialization or response wrappers; use existing controller helpers.

**Freedoms (the implementing agent MAY):**
- MAY choose any reasonable input-control pattern for the Settings "Scanner Tuning" form (`<input type="number">`, slider, etc.) provided range validation is enforced server-side.
- MAY implement CSV export client-side OR server-side; client-side is preferred if a shared utility already exists in the codebase.
- MAY pick the visual treatment of the bulk-action toolbar (sticky banner vs. floating action) so long as it appears only when ≥1 row is selected and clearly indicates the selected count.
- MAY split each phase's controller endpoint additions across one or more controllers consistent with existing project boundaries.
- MAY add new shared components under `web/src/components/` if the same UI shape recurs across phases (e.g., a generic sortable table header).
- MAY choose the test harness layout (xUnit fact vs. theory) consistent with `tests/HamptonHawksPlantSales.Tests/`.

## Execution Guidance
**Observe (signals to monitor during implementation):**
- `dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` succeeds with zero warnings on changed files (project's verification command).
- `dotnet test HamptonHawksPlantSales.sln --no-build -v quiet` -- all existing tests still pass plus new tests for the added service methods, validators, and concurrency.
- `cd web && npm run build` produces no TypeScript errors and no eslint regressions.
- React render warnings in the browser console for the new pages (sortable header, bulk toolbar) -- treat any new warning as a regression to fix before marking the phase done.
- Postgres EF migration runs cleanly via `dotnet ef database update` against the dev container.

**Orient (codebase conventions to maintain):**
- C# backend: PascalCase public members; camelCase JSON; thin controllers that delegate to services. See `OrdersController.cs` and `OrderService.cs` as the reference pair.
- Service interfaces live in `api/src/HamptonHawksPlantSales.Core/Interfaces/`; implementations in `api/src/HamptonHawksPlantSales.Infrastructure/Services/`. Register in `Program.cs` DI.
- One `IEntityTypeConfiguration<T>` per entity in `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/`; loaded via `ApplyConfigurationsFromAssembly`. Add new column mappings here, not via attributes.
- DTOs in `api/src/HamptonHawksPlantSales.Core/DTOs/` -- request DTOs separate from response DTOs. FluentValidation validators in `api/src/HamptonHawksPlantSales.Core/Validators/`.
- React pages: filename PascalCase ending in `Page.tsx`. State via Zustand stores under `web/src/stores/`. API calls via the typed clients in `web/src/api/` (mirror existing `ordersApi`, `settingsApi`, `reportsApi`).
- Soft delete: every read goes through global query filters by default; use `.IgnoreQueryFilters()` only via the existing `includeDeleted=true` admin path.
- API routes are kebab-case (`/api/admin-actions`, `/api/walkup/availability`).

**Escalate when:**
- A new external NuGet or npm package is needed beyond what's already in `*.csproj` / `package.json`.
- A schema change requires a non-trivial data backfill (more than the EF migration default value covers).
- A change would alter an existing controller route or DTO shape (risks frontend/backend drift).
- The bulk operation cap of 500 is shown by perf evidence to be too high (degrades response time below acceptable on the dev container).
- Auto-jump behavior changes would alter the per-order scan flow rather than only the lookup-page navigation logic.
- A test requires hitting external infra not present in the existing `docker-compose.yml`.

**Shortcuts (apply without deliberation, derived from existing code):**
- For all new endpoints: copy the controller method shape from `OrdersController.GetById` (action returns `ActionResult<ApiResponse<T>>`, wraps service call in try/catch, returns `Ok(ApiResponse<T>.Ok(result))` on success).
- For admin-pin endpoints: copy the attribute usage and reason capture pattern from existing `[RequiresAdminPin]` actions in `OrdersController` (e.g., `ForceComplete`); read reason via `HttpContext.Items["AdminReason"]`.
- For row-locking on bulk operations: copy `BeginTransactionAsync` + `SELECT ... FOR UPDATE` shape from `FulfillmentService.ScanBarcodeAsync`.
- For DTO validation: place a new `BulkCompleteOrdersRequestValidator : AbstractValidator<...>` next to existing validators in `Core/Validators/`; framework auto-registers via assembly scan.
- For React data fetching on new report pages: copy the `Promise.allSettled` pattern from `ReportsPage.tsx` initial load.
- For sort/select state on `OrdersListPage`: store in URL search params (`useSearchParams`) consistent with the existing list-page convention.
- For settings UI tweaks: follow the existing form pattern in `SettingsPage.tsx` (state via local `useState`, save via `settingsApi.update*`).
- Tests live in `api/tests/HamptonHawksPlantSales.Tests/`; mirror existing patterns (xUnit + Moq + FluentAssertions). Add `BulkCompleteOrdersTests`, `BulkSetStatusTests`, `SalesBySellerReportTests` etc.

## Decision Authority
**Agent decides autonomously:**
- File and folder placement of new pages, components, services, validators, controllers, DTOs (within established conventions).
- Internal naming of variables, helper methods, private fields.
- Test case design and grouping (one fact per scenario; one fixture per service under test).
- Default sort direction on each new sortable column.
- CSV export filename/encoding (use UTF-8 with BOM for Excel compatibility unless project convention dictates otherwise).
- Inline copy/microcopy on the new Settings form ("Scanner Tuning", help text), result modal labels, and empty-state messages — provided they match the project's existing tone.
- Whether to implement Sales-by-Plant in Phase 3 (stretch) — recommend implementing if Phase 3 work moves quickly; otherwise defer.

**Agent recommends, human approves:**
- Bulk operation max selection (500 vs. lower) if perf testing suggests reducing.
- Default values for the three new tunable settings (current proposal: 120 / `BestMatchWhenSingle` / `true`).
- Whether report rows should LEFT JOIN to include zero-revenue sellers/customers (current proposal: yes, for completeness in classroom roll-up).
- Whether revenue rounding follows two decimals or full `decimal` precision (current proposal: keep full precision in API, format on UI).
- Adding a new database index for `Orders.SellerId` if EF migration audit shows none exists.

**Human decides:**
- Whether to remove the existing `looksLikeOrderNumberLookup` heuristic entirely vs. keeping it as the `ExactMatchOnly` mode (default proposed: keep both, default to `BestMatchWhenSingle`).
- Whether to expose the bulk operation cap as a tunable setting in Phase 2 (deferred to a future phase per the design).
- Whether to ship the optional Sales-by-Plant report or hold for v2.
- Whether to remove the old form-based walk-up fallback (out of scope for this design; tracked in walk-up rewrite).
- Final timing of each phase relative to next year's sale.

## War-Game Results
**Most likely failure -- Settings cache divergence across kiosks.**
Scenario: Admin updates `PickupSearchDebounceMs` from 120 to 60 mid-day. Kiosks that loaded earlier still apply 120; cashiers may experience inconsistent input behavior. Mitigation: design intentionally documents this in Section 4 ("Reload kiosk to apply"); a future enhancement could broadcast settings via a refresh poll, deferred. Operational mitigation: the Settings form copy must clearly say "Reload each kiosk to apply." Acceptance criteria for Phase 1 includes this copy.

**Scale stress -- bulk operations and report queries with 10 stations.**
Scenario: 10 stations actively scanning while admin runs a 500-order Mass Complete. Bulk-complete uses per-order row lock inside one transaction; concurrent scans on those orders block briefly until the bulk transaction commits. With 500 orders, total lock time depends on per-order work but is likely sub-second on the dev container; on the production mini-PC, expect a noticeable but bounded pause. Mitigation: the per-order bulk pattern serializes correctly; if perf testing shows >2s pauses on the production-target machine, lower the cap to 100-200. The `/forge` spec MUST include a perf test against a seeded 5000-order dataset.

**Dependency disruption -- Postgres unavailability.**
Scenario: Postgres container restarts mid-sale. Same risk as today; not new. Mitigation is operational (Docker Compose `restart: always`), not in this design's scope. The design MUST NOT introduce any new dependencies that increase blast radius.

**6-month maintenance assessment.**
A new contributor reading the saved design + the resulting `/forge` spec + each phase sub-spec should be able to: (a) understand the three phases and how they interact (or don't), (b) trace each new endpoint to the spec section that introduced it, (c) re-run the build/test commands listed in `forge-project.json`, and (d) modify a single phase without needing to understand the others. The phased structure plus the "no cross-phase coupling" boundary in the architecture section keeps cognitive load bounded.

## Evaluation Metadata
- Evaluated: 2026-04-25
- Cynefin Domain: Complicated (multiple known approaches, requires analysis, single best answer exists)
- Critical Gaps Found: 0 (0 resolved)
- Important Gaps Found: 0 (0 resolved)
- Suggestions: 0
- Framework layers added: Commander's Intent, Execution Guidance, Decision Authority, War-Game Results

## Next Steps
- [ ] Auto-chain: `/forge` -> `/forge-prep` -> `/forge-red-team` (master + each phase)
- [ ] After red-team review, address CRITICAL findings before `/forge-dark-factory`
- [ ] Verify `Orders.SellerId` index in EF configurations during `/forge` spec creation
