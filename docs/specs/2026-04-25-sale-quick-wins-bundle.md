# Sale Quick Wins Bundle

## Meta
- Client: Hampton Hawks (school plant sale)
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-25
- Author: Caleb Bennett
- Source: `docs/plans/2026-04-25-sale-quick-wins-bundle-design.md` (evaluated)
- Status: ready-to-execute
- Quality scores (out of 5):
  - Outcome clarity: 5
  - Scope boundaries: 5
  - Decision guidance: 5
  - Edge coverage: 4
  - Acceptance criteria: 4
  - Decomposition: 5
  - Purpose alignment: 5
  - **Total: 33/35** (walk-away quality)

## Outcome
Three independently shippable PRs land in `main`:
1. **Phase 1 PR -- Settings + Scan UX:** new admin-tunable settings (debounce, auto-jump mode, multi-scan toggle); pickup lookup auto-jumps on a single exact `orderNumber`/`barcode` match without the format heuristic; pickup scan accepts back-to-back scans without modal interruption; on Complete Order the operator lands on `/pickup` with the search input focused; the Complete Order button (and other primary scan-screen actions) sits above-the-fold near the barcode input with touch-friendly hit targets for the touchscreen POS terminals.
2. **Phase 2 PR -- Orders Bulk Actions:** `OrdersListPage` columns sort asc/desc with state in URL params; row checkboxes + select-all surface a sticky bulk-action toolbar; new `/api/orders/bulk-complete` and `/api/orders/bulk-status` endpoints (admin-pin gated, capped at 500 per call) drive a per-order result modal.
3. **Phase 3 PR -- Reports Expansion:** new `/api/reports/sales-by-seller`, `/api/reports/sales-by-customer`, optional `/api/reports/sales-by-plant`; new pages under `web/src/pages/reports/` with sortable tables and CSV export.

Done means: each PR builds clean, all tests pass, the new endpoints/components are exercised by tests, and a manual smoke verifies the kiosk and reports pages render without console errors.

## Intent
**Trade-off hierarchy (when valid approaches conflict):**
- **Existing patterns over ideal architecture.** This is a fast-moving polish bundle; matching `OrderService` / `FulfillmentService` shape beats inventing new abstractions.
- **Sale-day reliability over feature breadth.** If a phase has scope tension, cut features rather than ship something fragile.
- **Explicit defaults over hidden magic.** New settings default to current hardcoded values; no behavior change unless an admin opts in.
- **Auditable over silent.** Every admin-pin action writes `AdminAction`. Every bulk operation returns a per-order outcome.

**Decision boundaries (escalate vs. decide):**
- Decide autonomously: file/folder placement, internal naming, test design, default sort directions, microcopy, helper method shape.
- Recommend + ask: bulk operation cap value, default tunable settings values, whether report rows include zero-revenue entities, decimal precision rules.
- Stop and ask: any new external NuGet/npm package; any change that alters an existing controller route or DTO shape; any change that alters the per-order scan flow contract; any need to weaken existing soft-delete or `[RequiresAdminPin]` guarantees.

## Context
The spring 2026 sale ran 5 checkout stations smoothly but exposed three operational paper cuts:
- The pickup lookup screen sometimes failed to auto-jump on barcode scans, slowing every customer.
- Operators had to hand-fix orders that should have been completed but were stuck "in progress".
- Reports lacked per-student / per-buyer revenue, blocking quick post-sale reconciliation.

The team is targeting ~10 stations for the next sale. This bundle is the highest-leverage set of fixes that don't require new architectural patterns. All three phases extend existing services and routes; no new architectural primitives are introduced.

**Key existing patterns to follow (from `CLAUDE.md` and codebase scan):**
- `ApiResponse<T>` envelope on every endpoint -- `ApiResponse<T>.Ok(...)` / `ApiResponse<T>.Fail(...)`.
- Thin controllers; business logic in `Infrastructure/Services/`; interfaces in `Core/Interfaces/`.
- `[RequiresAdminPin]` filter validates `X-Admin-Pin` and `X-Admin-Reason` headers; reason via `HttpContext.Items["AdminReason"]`.
- Soft delete via `BaseEntity.DeletedAt` + EF global query filters.
- Concurrency via `BeginTransactionAsync()` + `SELECT ... FOR UPDATE` (see `FulfillmentService.ScanBarcodeAsync`).
- One `IEntityTypeConfiguration<T>` per entity; assembly-scanned.
- React: Zustand stores, Axios API clients in `web/src/api/`, page components in `web/src/pages/`.
- FluentValidation for DTOs in `Core/Validators/`.

**Schema confirmed during evaluation:**
- `Order.SellerId` (Guid?, on the order, not the customer) -- this is the "student" link for reports.
- `OrderLine.QtyOrdered`, `OrderLine.QtyFulfilled` -- field names matter for queries.
- `PlantCatalog.Price` (decimal?) -- revenue source.
- `AppSettings` currently has only `SaleClosed` + `SaleClosedAt`.

## Requirements

1. New tunable settings persist in `AppSettings`, default to current behavior, and are editable from `SettingsPage` by admins via existing pin flow.
2. `PickupLookupPage` consumes the configured debounce; auto-jumps on a single exact `orderNumber` OR `barcode` match without the existing `looksLikeOrderNumberLookup` outer gate when mode is `BestMatchWhenSingle`.
3. `PickupScanPage` accepts rapid sequential scans without a blocking modal; on Complete Order success the operator returns to `/pickup` with the search input focused.
3a. `PickupScanPage` renders the "Complete Order" button (and other primary action buttons) above-the-fold, within ~150 vertical CSS px of the barcode input on a 1024×768 viewport, with touch-friendly hit targets (≥44×44 CSS px, comfortable padding). Volunteers should not have to scroll to reach Complete Order.
4. `OrdersListPage` columns are sortable (orderNumber, customerDisplayName, status, itemsOrdered, itemsFulfilled, createdAt); sort state lives in URL search params.
5. `OrdersListPage` supports row selection (per-row + select-all) and surfaces a sticky bulk-action toolbar when ≥1 row is selected.
6. New `/api/orders/bulk-complete` endpoint (admin-pin) marks all selected orders complete where eligibility holds (`QtyFulfilled >= QtyOrdered` for every line); ineligible orders return as skipped with a reason.
7. New `/api/orders/bulk-status` endpoint (admin-pin) sets an arbitrary target status on selected orders; logs `AdminAction` per order.
8. Both bulk endpoints cap selection at 500; validate via FluentValidation; use `BeginTransactionAsync()` + per-order `SELECT FOR UPDATE`.
9. New `/api/reports/sales-by-seller` returns `ApiResponse<List<SalesBySellerRow>>` with orderCount, itemsOrdered, itemsFulfilled, revenueOrdered, revenueFulfilled.
10. New `/api/reports/sales-by-customer` returns the same shape keyed by customer.
11. Optional `/api/reports/sales-by-plant` returns the same shape keyed by plant (Phase 3 stretch).
12. New report pages under `web/src/pages/reports/` render sortable tables and provide CSV export.
13. All new code passes `dotnet build` and `dotnet test`; React side passes `npm run build` with no new TypeScript or eslint regressions.
14. The existing per-order scan flow, fulfillment service, and walk-up flow are not modified.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Settings tunables -- backend foundation

- **Scope:** Extend `AppSettings` with three new columns. Add EF migration with default values matching current hardcoded behavior. Extend `ISettingsService` and `SettingsController` with a tunables-update endpoint. Provide DTOs and FluentValidation. No frontend in this sub-spec.
- **Files (target, not exhaustive):**
  - `api/src/HamptonHawksPlantSales.Core/Models/AppSettings.cs`
  - `api/src/HamptonHawksPlantSales.Core/DTOs/SettingsDtos.cs`
  - `api/src/HamptonHawksPlantSales.Core/Validators/UpdateScannerTuningRequestValidator.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/ISettingsService.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/SettingsService.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/AppSettingsConfiguration.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{timestamp}_AddScannerTunings.cs` (generated)
  - `api/src/HamptonHawksPlantSales.Api/Controllers/SettingsController.cs`
  - `api/tests/HamptonHawksPlantSales.Tests/Settings/ScannerTuningTests.cs` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `AppSettings` model has `PickupSearchDebounceMs` (int), `PickupAutoJumpMode` (enum: `ExactMatchOnly` | `BestMatchWhenSingle`), and `PickupMultiScanEnabled` (bool).
  - `[STRUCTURAL]` `SettingsResponse` exposes the three new fields; `UpdateScannerTuningRequest` DTO exists with FluentValidation.
  - `[MECHANICAL]` `dotnet ef migrations script` shows a migration adding the three columns with non-null defaults (120 / `BestMatchWhenSingle` / `true`).
  - `[BEHAVIORAL]` `PUT /api/settings/scanner-tuning` with valid body + `X-Admin-Pin` returns 200 + `ApiResponse<SettingsResponse>` with updated fields persisted.
  - `[BEHAVIORAL]` `PUT /api/settings/scanner-tuning` with `PickupSearchDebounceMs=10` (out of range 50-500) returns 400 + `ApiResponse.Fail` with descriptive validator message.
  - `[BEHAVIORAL]` `PUT /api/settings/scanner-tuning` without admin pin returns 403.
  - `[MECHANICAL]` `dotnet test` passes including the new tests.
- **Dependencies:** none

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. Scan UX -- frontend changes

- **Scope:** Wire `appStore` settings to the new tunables. Update `PickupLookupPage` auto-jump logic. Update `PickupScanPage` for multi-scan + post-complete redirect. Add Settings page "Scanner Tuning" admin section. No backend changes here.
- **Files:**
  - `web/src/stores/appStore.ts`
  - `web/src/api/settings.ts`
  - `web/src/types/settings.ts`
  - `web/src/components/shared/SearchBar.tsx` (no behavior change; consumer wires debounce)
  - `web/src/pages/pickup/PickupLookupPage.tsx`
  - `web/src/pages/pickup/PickupScanPage.tsx`
  - `web/src/pages/SettingsPage.tsx`
  - `web/src/utils/orderLookup.ts` (small helpers added; existing helpers preserved)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `web/src/types/settings.ts` exports `AppSettings` with the three new optional fields typed.
  - `[STRUCTURAL]` `SettingsPage` renders a "Scanner Tuning" form with a number input for debounce (50-500), a select for auto-jump mode, and a toggle for multi-scan, gated behind admin auth.
  - `[BEHAVIORAL]` On `PickupLookupPage`, when `pickupAutoJumpMode === 'BestMatchWhenSingle'` and the search resolves to exactly one order via `orderNumber` OR `barcode` exact match, the page navigates to `/pickup/{orderId}` even when the value would have failed the previous `looksLikeOrderNumberLookup` heuristic.
  - `[BEHAVIORAL]` On `PickupScanPage`, two consecutive successful scans complete without a blocking modal between them; the input remains focused after each scan.
  - `[BEHAVIORAL]` On `PickupScanPage`, after `Complete Order` succeeds, the route changes to `/pickup` and the lookup search input is auto-focused on mount.
  - `[BEHAVIORAL]` On `PickupScanPage`, if `Complete Order` returns an error, the page does NOT navigate and shows the error inline.
  - `[STRUCTURAL]` On `PickupScanPage` at a 1024×768 viewport, the "Complete Order" button is rendered within ~150 vertical CSS px of the barcode/SKU input element (no scroll required to reach it). Achieved by hoisting the action bar near the input, not by absolute positioning that overlaps content.
  - `[STRUCTURAL]` Primary action buttons on `PickupScanPage` (Complete Order, Manual Fulfill, Undo Last Scan, Recover) have a minimum hit target of 44×44 CSS px with comfortable padding suitable for touchscreen use (apply via shared button class, not per-instance).
  - `[HUMAN REVIEW]` On a 1024×768 touchscreen POS terminal, a volunteer can tap Complete Order without scrolling and the button feels comfortable to hit on the first try.
  - `[MECHANICAL]` `npm run build` succeeds with no new TypeScript errors.
- **Dependencies:** SS-01

---
sub_spec_id: SS-03
phase: run
depends_on: []
---

### 3. Orders bulk actions -- backend

- **Scope:** Add `BulkCompleteAsync` and `BulkSetStatusAsync` to `IOrderService`. Add request DTOs + FluentValidation. Add new `OrdersController` actions. Per-order row locks + transactional commit. Returns per-order outcome list.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/IOrderService.cs`
  - `api/src/HamptonHawksPlantSales.Core/DTOs/OrderDtos.cs` (new request + response DTOs)
  - `api/src/HamptonHawksPlantSales.Core/Validators/BulkCompleteOrdersRequestValidator.cs` (new)
  - `api/src/HamptonHawksPlantSales.Core/Validators/BulkSetOrderStatusRequestValidator.cs` (new)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs`
  - `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs`
  - `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkCompleteTests.cs` (new)
  - `api/tests/HamptonHawksPlantSales.Tests/Orders/BulkSetStatusTests.cs` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `IOrderService` exposes `BulkCompleteAsync(IReadOnlyList<Guid> ids, string reason)` and `BulkSetStatusAsync(IReadOnlyList<Guid> ids, OrderStatus targetStatus, string reason)`.
  - `[STRUCTURAL]` `BulkOperationResult` DTO contains a per-order outcome (`OrderId`, `Outcome`, optional `Reason`).
  - `[BEHAVIORAL]` `POST /api/orders/bulk-complete` with valid admin pin + 5 order IDs (3 fully fulfilled, 2 with unfulfilled lines) returns 200 + `ApiResponse<BulkOperationResult>` showing 3 completed and 2 skipped with reason `"unfulfilled lines"`.
  - `[BEHAVIORAL]` `POST /api/orders/bulk-complete` without admin pin returns 403.
  - `[BEHAVIORAL]` `POST /api/orders/bulk-complete` with 501 IDs returns 400 + `ApiResponse.Fail` with cap-exceeded message.
  - `[BEHAVIORAL]` `POST /api/orders/bulk-status` with target `Completed` and admin pin sets the requested status regardless of fulfillment state and writes one `AdminAction` row per order.
  - `[STRUCTURAL]` Both service methods use `_db.Database.BeginTransactionAsync()` and `SELECT ... FOR UPDATE` per order (verifiable in code review or by an integration test that demonstrates serialization with a concurrent scan).
  - `[BEHAVIORAL]` Each bulk-complete and bulk-status request writes a Serilog `Information` log line containing: action type, requested count, eligible count, skipped count, the admin reason header value. Verifiable by capturing log output during the test.
  - `[MECHANICAL]` `dotnet test` passes including the new tests.
- **Dependencies:** none

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-03']
---

### 4. Orders bulk actions -- frontend

- **Scope:** Extend `OrdersListPage` with sortable columns (URL-param state), row selection, sticky bulk-action toolbar, and result modal. Wire admin pin via `useAdminAuth`.
- **Files:**
  - `web/src/pages/orders/OrdersListPage.tsx`
  - `web/src/api/orders.ts` (new bulk endpoints)
  - `web/src/types/order.ts` (BulkOperationResult shape)
  - `web/src/components/orders/BulkActionToolbar.tsx` (new)
  - `web/src/components/orders/BulkResultModal.tsx` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `OrdersListPage` renders sortable column headers for at least: order number, customer name, status, items ordered, items fulfilled, created at. Click toggles asc/desc and writes `?sortBy=...&sortDir=...` to URL search params.
  - `[STRUCTURAL]` Each row has a checkbox; the table header has a select-all checkbox; selecting any row reveals a sticky `BulkActionToolbar` showing the selected count and two buttons: "Mass Complete" and "Change Status...".
  - `[BEHAVIORAL]` Clicking "Mass Complete" with N rows selected prompts for admin pin, then calls `/api/orders/bulk-complete` with the selected ids; the response renders in `BulkResultModal` with per-order outcome.
  - `[BEHAVIORAL]` Clicking "Change Status..." opens a status picker, prompts for admin pin + reason, then calls `/api/orders/bulk-status`; result modal renders per-order outcome.
  - `[BEHAVIORAL]` Selecting more than 500 rows surfaces a UI warning before the request and disables the bulk buttons; the server-side cap is the source of truth.
  - `[INTEGRATION]` Selecting 3 fully-fulfilled and 2 unfulfilled orders, clicking Mass Complete, supplying admin pin: the result modal lists 3 completed + 2 skipped, the page refreshes to reflect new statuses for the 3 completed orders, and an `AdminAction` row is queryable for each completed order via the existing admin actions endpoint.
  - `[MECHANICAL]` `npm run build` succeeds.
- **Dependencies:** SS-03

---
sub_spec_id: SS-05
phase: run
depends_on: []
---

### 5. Reports expansion -- backend

- **Scope:** Add aggregate methods to `IReportsService` and matching `ReportsController` endpoints. Use EF Core LINQ joining Sellers/Customers/PlantCatalog through Orders + OrderLines, honoring soft-delete filters. Return shape: `orderCount`, `itemsOrdered`, `itemsFulfilled`, `revenueOrdered`, `revenueFulfilled`.
- **Files:**
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs`
  - `api/src/HamptonHawksPlantSales.Core/DTOs/ReportsDtos.cs` (new row DTOs)
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs`
  - `api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs`
  - `api/tests/HamptonHawksPlantSales.Tests/Reports/SalesBySellerTests.cs` (new)
  - `api/tests/HamptonHawksPlantSales.Tests/Reports/SalesByCustomerTests.cs` (new)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `IReportsService` exposes `GetSalesBySellerAsync()`, `GetSalesByCustomerAsync()`, and (optional) `GetSalesByPlantAsync()`. Each returns a typed list DTO.
  - `[BEHAVIORAL]` `GET /api/reports/sales-by-seller` returns 200 + `ApiResponse<List<SalesBySellerRow>>`. With seeded data of 3 sellers each with 2 orders and 5 lines, the response includes one row per seller with the correct sums.
  - `[BEHAVIORAL]` `GET /api/reports/sales-by-customer` returns the same shape keyed by customer.
  - `[STRUCTURAL]` Each row contains: `id`, `displayName`, `orderCount`, `itemsOrdered`, `itemsFulfilled`, `revenueOrdered`, `revenueFulfilled`. `revenueOrdered = SUM(QtyOrdered * Price)`; `revenueFulfilled = SUM(QtyFulfilled * Price)`. NULL `Price` rows contribute 0 (use `COALESCE` or null-aware aggregation).
  - `[INFRASTRUCTURE]` Verify `Orders.SellerId` and `Orders.CustomerId` columns are indexed. If not, add an EF migration creating the indexes alongside the report endpoints.
  - `[BEHAVIORAL]` Soft-deleted orders/lines are excluded from totals by default.
  - `[MECHANICAL]` `dotnet test` passes including the new tests.
- **Dependencies:** none

---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-05']
---

### 6. Reports expansion -- frontend

- **Scope:** Add new report pages with sortable tables and CSV export. Link them from `ReportsPage`.
- **Files:**
  - `web/src/api/reports.ts` (new methods)
  - `web/src/types/reports.ts` (new row types)
  - `web/src/pages/reports/SalesBySellerPage.tsx` (new)
  - `web/src/pages/reports/SalesByCustomerPage.tsx` (new)
  - `web/src/pages/reports/SalesByPlantPage.tsx` (new, optional stretch)
  - `web/src/pages/ReportsPage.tsx`
  - `web/src/utils/csvExport.ts` (new helper if no equivalent exists)
- **Acceptance criteria:**
  - `[STRUCTURAL]` `ReportsPage` shows a "Sales Breakdowns" card group with links to "Sales by Student" and "Sales by Buyer" (and optionally "Sales by Plant").
  - `[STRUCTURAL]` Each new page renders a sortable table of the API response and a "Download CSV" button.
  - `[BEHAVIORAL]` Clicking "Download CSV" exports the current sort order with header row plus all data rows; opens cleanly in Excel (UTF-8 with BOM).
  - `[INTEGRATION]` Loading `/reports/sales-by-seller` issues `GET /api/reports/sales-by-seller`, renders rows in a sortable table, and clicking "Download CSV" produces a file matching the rendered rows.
  - `[MECHANICAL]` `npm run build` succeeds.
- **Dependencies:** SS-05

## Edge Cases

- **Settings cache divergence across kiosks.** Admin updates a tunable; existing kiosks keep prior value until reload. Mitigation: copy on the Settings form reads "Reload each kiosk to apply." Documented; not addressed via live broadcast.
- **Auto-jump false positive.** A scan that is a partial customer-name match must NOT navigate. Only single exact `orderNumber`/`barcode` matches trigger navigation in `BestMatchWhenSingle` mode.
- **Multi-scan racing.** Two scans within ms; sequentialize by awaiting the previous scan request before clearing input. Add a small client-side queue with max 5 entries to absorb scanner double-fires.
- **Bulk operation partial failure.** Per-order result list returned; transaction commits eligible orders, marks ineligible with reason; UI shows summary modal.
- **Bulk operation concurrent edit.** Another user fulfills a line mid-bulk-complete. Per-order `SELECT FOR UPDATE` serializes; bulk operates on consistent state.
- **Bulk over 500.** UI warns + disables; server validates and rejects with descriptive `ApiResponse.Fail`.
- **Bulk admin pin missing.** `[RequiresAdminPin]` returns 403; UI prompts for pin before sending.
- **Reports empty result.** Show "No data" empty state explaining likely cause (sale not started, all soft-deleted, etc.).
- **Reports null Price.** `Price` is nullable on `PlantCatalog`; treat NULL as 0 for revenue (use `COALESCE`).
- **Reports soft-deleted rows.** Excluded by default via global query filters.
- **Settings out of valid range.** FluentValidation rejects (50 ≤ debounce ≤ 500); clear inline error in the form.
- **Test isolation.** Bulk operation tests must use a per-test database scope (existing test fixture) to avoid bleed.
- **Settings reload semantics.** When admin updates a tunable, existing kiosk tabs do not pick up the new value until reload. The Settings form copy MUST say "Reload each kiosk to apply." Manual smoke verifies that reload picks up the new value.
- **Bulk operation observability.** Each bulk-complete / bulk-status request emits a Serilog `Information` log with: requested count, eligible count, skipped count, reason summary, requesting admin pin holder (or `X-Admin-Reason`). This makes 3-AM diagnosis tractable.
- **Reports CSV may contain PII.** `Sales by Buyer` exports include `customerDisplayName` and revenue. While the existing reports endpoints are not admin-gated (matching existing pattern), the CSV download produces a file the admin will likely save locally. Note in the cheatsheet that these CSVs should not be emailed to non-admins. No auth change in this design.
- **TouchButton coordination across bundle waves.** SS-02 produces a shared `TouchButton`. SS-04 references it as optional. Recommend SS-02 land before SS-04 starts, OR SS-04 defines the same min-hit-target classes locally to avoid coupling. The spec's preferred path is the latter (tolerant fallback) so SS-04 can ship even if SS-02 is delayed.

## Out of Scope

- Live broadcast of settings changes to running kiosks (admin must reload).
- Per-kiosk setting overrides (global only).
- Multi-order ad-hoc scan aggregation (belongs to the Pick-list Barcode design).
- Walk-up cash-register rewrite (separate design).
- Real-time / streaming reports.
- Per-line price overrides on `OrderLine`.
- New external NuGet or npm dependencies.
- Modifications to per-order scan / fulfillment flow.
- Receipt or thermal printer integration.

## Constraints

### Musts
- All new endpoints return `ApiResponse<T>` envelope.
- All admin operations carry `[RequiresAdminPin]` and persist `AdminAction`.
- All new DB columns use EF migrations with default values matching current behavior.
- Bulk operations use `BeginTransactionAsync()` + per-order `SELECT FOR UPDATE`.
- All new reads honor existing soft-delete query filters.
- Frontend extends `appStore` settings cache; does not introduce a new state store for this work.
- `OrdersListPage` sort/select state lives in URL search params consistent with project convention.

### Must-Nots
- MUST NOT modify the existing per-order scan flow contract.
- MUST NOT add live-broadcast of settings.
- MUST NOT introduce per-line price overrides.
- MUST NOT cap bulk selection lower than 500 unless perf evidence forces it.
- MUST NOT add new external dependencies (NuGet/npm) without escalation.
- MUST NOT alter any existing controller route or DTO shape.

### Preferences
- Prefer reusing existing patterns and components over inventing new ones.
- Prefer URL search params for list-page state (sort, filters, selection) over component state when state should survive reloads.
- Prefer `Promise.allSettled` for parallel fetches on report pages (matches existing `ReportsPage` pattern).
- Prefer client-side CSV export for portability; server-side only if existing utility makes it trivial.
- Prefer LEFT JOIN in report aggregations to include zero-revenue entities for completeness.

### Escalation Triggers
- Need for any new external NuGet or npm package.
- Bulk cap of 500 fails perf testing on the production-target mini-PC.
- Required schema change cannot be expressed as an additive nullable column with default.
- Any change that would touch the per-order scan/fulfillment flow contract.

## Verification

Each PR is independently verifiable:

**Phase 1 PR (SS-01 + SS-02):**
1. `dotnet build` and `dotnet test` clean (covers SS-01).
2. Apply migration via `dotnet ef database update`; query `SELECT * FROM "AppSettings"` shows the three new columns with default values.
3. `npm run build` clean (covers SS-02).
4. Manual: in dev, change `PickupSearchDebounceMs` to 80 via SettingsPage; reload kiosk; barcode scan input feels noticeably faster; auto-jump fires on a single exact match that previously didn't.
5. Manual: on `PickupScanPage`, scan two consecutive plant tags without clicking anywhere -- both succeed; click Complete Order -- routes to `/pickup` with the search field auto-focused.

**Phase 2 PR (SS-03 + SS-04):**
1. `dotnet build` / `dotnet test` clean.
2. `npm run build` clean.
3. Manual: select 5 orders, click Mass Complete with admin pin -- result modal shows per-order outcome; refresh confirms statuses persisted.
4. Manual: select 5 orders with mixed states, click Change Status -> Completed with admin pin; result modal shows all status changes; admin actions log shows new entries.
5. Manual: select 600 orders -- UI warns + disables button before submission; even if forced, server returns 400.

**Phase 3 PR (SS-05 + SS-06):**
1. `dotnet build` / `dotnet test` clean.
2. `npm run build` clean.
3. Manual: visit `/reports/sales-by-seller` -- table renders; sort by revenue descending works; CSV download opens cleanly in Excel.
4. Manual: visit `/reports/sales-by-customer` -- same shape.
5. Manual: visit `ReportsPage` -- new "Sales Breakdowns" cards link to the new pages.

**Cross-cutting:**
- After all three PRs land, run `dotnet test` and `npm run build` against the merged main.
- Manually verify the existing pickup/scan flow still works (regression check on the unchanged path).

## Phase Specs

Refined by `/forge-prep` on 2026-04-25.

| Sub-Spec | Phase Spec |
|----------|------------|
| SS-01 Settings tunables -- backend | `docs/specs/sale-quick-wins-bundle/sub-spec-1-settings-tunables-backend.md` |
| SS-02 Scan UX -- frontend | `docs/specs/sale-quick-wins-bundle/sub-spec-2-scan-ux-frontend.md` |
| SS-03 Orders bulk actions -- backend | `docs/specs/sale-quick-wins-bundle/sub-spec-3-orders-bulk-backend.md` |
| SS-04 Orders bulk actions -- frontend | `docs/specs/sale-quick-wins-bundle/sub-spec-4-orders-bulk-frontend.md` |
| SS-05 Reports expansion -- backend | `docs/specs/sale-quick-wins-bundle/sub-spec-5-reports-backend.md` |
| SS-06 Reports expansion -- frontend | `docs/specs/sale-quick-wins-bundle/sub-spec-6-reports-frontend.md` |

Index: `docs/specs/sale-quick-wins-bundle/index.md`
