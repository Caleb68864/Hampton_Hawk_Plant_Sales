# Joy Shell + Reports Expansion

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-26
- Author: Caleb Bennett (drafted with Claude during AFK build)
- Source: user feedback — "almost none of these got the new theme" (the app shell was untouched) + gap analysis recommendation to expand the Reports tab
- Reference: `docs/plans/joy-pass-demo.html`
- Workflow: manual forge run (factory CLI unavailable; implementer + verifier dispatched directly)

## Outcome
Two related visual + capability lifts in one branch:

1. **The app shell itself wears the joy vocabulary.** AppLayout's header is rebuilt to match the demo (gilded crest dot, eyebrow tracking, refined nav pills); the main content area gets a paper-grain background so EVERY page — wrapped or not — sits on warm Hampton Hawks paper. Sale-closed banner is restyled to read as a calm system message instead of a Bootstrap alert.
2. **Reports tab becomes a true operations hub.** Six new server-side aggregations land (`/api/reports/daily-sales`, `/payment-breakdown`, `/walkup-vs-preorder`, `/status-funnel`, `/top-movers`, `/outstanding-aging`), each with a sortable table page and CSV export. The Reports landing page is rebuilt as a categorized hub: Sales (by-seller, by-customer, by-plant, daily-sales), Operations (status-funnel, outstanding-aging), Money (payment-breakdown, walkup-vs-preorder), Inventory (top-movers, leftover-inventory). Volunteers and admins find the report they need in one click.

## Intent
**Trade-off hierarchy:**
- **Visual continuity over per-page polish.** Lifting the shell once benefits every page in the app, including pages that will never be in scope for a per-page wrap.
- **Real aggregations over mock data.** Every new report queries actual `Orders` / `OrderLines` data with `Where DeletedAt == null && Status != Draft` filters that match `ReportService` precedent.
- **Sortable + exportable over fancy charts.** Volunteers print and share these reports during the sale. CSV export is non-negotiable; charts are nice-to-have.
- **Auditable, additive change.** No schema migrations. No new dependencies. Pure read-side work plus a shell rebuild.

**Decision boundaries:**
- Decide autonomously: aggregation SQL shape, DTO field names, sort column choices, CSV column ordering, hub category placement.
- Recommend + ask: any report that requires a schema change (capture as a follow-up spec, do not block).
- Stop and ask: any need to add charting library; any aggregation that would scan > 5000 rows without an index; aesthetic departure from `joy-pass-demo.html`.

## Context
The earlier post-sale-improvements run + back-office sweep wrapped 16 pages in joy chrome but never touched `web/src/layouts/AppLayout.tsx`. The user noticed the shell still looks Bootstrappy and asked for it to be brought into the system. Separately, the gap analysis showed the Reports tab is technically functional (3 sales breakdowns ship) but reads as a stub — there is real demand for daily activity, payment, status, and aging breakdowns that operations leads have been asking about.

Schema today supports: order date (`CreatedAt`), seller, customer, walk-up flag (`IsWalkUp`), payment method (`PaymentMethod` string), amount tendered (`AmountTendered`), status (`OrderStatus`), and per-line plant + qty ordered/fulfilled. Every report below is queryable with current schema; nothing requires migration.

## Requirements

### Wave 1 — App shell joy treatment

1. `web/src/layouts/AppLayout.tsx` is rebuilt:
   - Header gradient stays (`hawk-700 → hawk-800 → hawk-900`) with gold-300 bottom border and gilded radial-glow accent (per demo `.brand-header::after`).
   - Brand block uses a "crest dot" — a gilded gradient circle (`gold-200 → gold-500 → gold-800`) instead of the white-padded logo. Logo image moves inside the circle.
   - Brand text uses `font-display` + the `eyebrow` uppercase-tracked label pattern.
   - Nav pills use the joy press shadow on the active state instead of plain white background; inactive pills get the gilded hover treatment from the demo.
   - The `<main>` element gains `paper-grain` background utility so every routed page renders on warm paper, regardless of whether the page itself wraps in `JoyPageShell`.
2. The sale-closed banner is restyled to a calm joy-style alert (rounded, with the joy plum shadow, paper-on-red instead of solid red).
3. `KioskLayout.tsx` gets the same paper-grain background treatment so kiosk-mode pages also sit on warm paper. Kiosk header chrome is untouched (kiosk has its own header design needs).
4. `App.tsx` is unchanged structurally — only layout components are rebuilt.

### Wave 2 — New reports backend

5. `IReportService` gains six methods, each returning a typed Response DTO:
   - `GetDailySalesAsync(DateTime? from, DateTime? to)` → `DailySalesResponse { Days: [{ Date, OrderCount, ItemCount, Revenue, WalkUpCount, PreorderCount }] }`
   - `GetPaymentBreakdownAsync(DateTime? from, DateTime? to)` → `PaymentBreakdownResponse { Methods: [{ Method, OrderCount, Revenue, AverageOrder }] }` — group by `Order.PaymentMethod` (null → "Unspecified")
   - `GetWalkupVsPreorderAsync(DateTime? from, DateTime? to)` → `WalkupVsPreorderResponse { WalkUp: { OrderCount, ItemCount, Revenue, AverageOrder }, Preorder: { ... }, WalkUpRatio }`
   - `GetOrderStatusFunnelAsync()` → `StatusFunnelResponse { Buckets: [{ Status, Count, Percent }], Total }` — counts per `OrderStatus`, excluding `Draft` from totals
   - `GetTopMoversAsync(int limit = 25)` → `TopMoversResponse { Plants: [{ PlantCatalogId, PlantName, QtyOrdered, QtyFulfilled, OrderCount }] }` — group order lines by `PlantCatalogId`, sort by `QtyOrdered` desc
   - `GetOutstandingAgingAsync()` → `OutstandingAgingResponse { Buckets: [{ Bucket, Count, OldestAgeHours }] }` — buckets: `<24h`, `1-3d`, `3-7d`, `>7d`, computed from `CreatedAt` for orders in `Open` or `InProgress`
6. `ReportsController` gains six new GET routes (kebab-case):
   - `GET /api/reports/daily-sales?from=&to=`
   - `GET /api/reports/payment-breakdown?from=&to=`
   - `GET /api/reports/walkup-vs-preorder?from=&to=`
   - `GET /api/reports/status-funnel`
   - `GET /api/reports/top-movers?limit=`
   - `GET /api/reports/outstanding-aging`
   Each returns `ApiResponse<T>.Ok(result)`. No admin-pin required (read-only).
7. All aggregations exclude soft-deleted rows (`DeletedAt == null`) and `OrderStatus.Draft`, matching `ReportService` precedent (see lines around `GetDashboardMetricsAsync`).
8. xUnit tests in `api/tests/HamptonHawksPlantSales.Tests/` for each new method, using in-memory provider — minimum: empty-data case + happy-path with seeded orders.

### Wave 3 — Reports hub frontend

9. `web/src/types/reports.ts` (new file or extend existing) gets TS mirrors of all six new response DTOs.
10. `web/src/api/reports.ts` (extend) gets six new API client methods matching the routes.
11. Six new pages under `web/src/pages/reports/`:
    - `DailySalesPage.tsx`
    - `PaymentBreakdownPage.tsx`
    - `WalkupVsPreorderPage.tsx`
    - `StatusFunnelPage.tsx`
    - `TopMoversPage.tsx`
    - `OutstandingAgingPage.tsx`
   Each: wrapped in `<JoyPageShell>`, sortable table (use existing pattern from `SalesBySellerPage`), CSV export via existing `csvExport` util, date-range filter where applicable.
12. `web/src/pages/ReportsPage.tsx` is rebuilt as a categorized hub:
    - Hero: dashboard metrics card group (keep existing MetricCards)
    - "Sales Breakdowns" group (existing): SalesBySeller, SalesByCustomer, SalesByPlant, **DailySales**
    - "Operations" group (new): StatusFunnel, OutstandingAging
    - "Money" group (new): PaymentBreakdown, WalkupVsPreorder
    - "Inventory" group (new): TopMovers, LeftoverInventory
   Each card: `SectionHeading level={3}`, brief description, `TouchButton` link.
13. `App.tsx` registers the six new routes under `/reports/...`.
14. `web/src/layouts/AppLayout.tsx` nav is updated: remove the explicit "Leftover Inventory" top-level link (it's now inside Reports → Inventory) so the nav is less crowded.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. App shell joy treatment

- **Scope:** Rebuild `AppLayout` header + main background; restyle sale-closed banner; apply paper-grain to `KioskLayout` main area.
- **Files (modify):** `web/src/layouts/AppLayout.tsx`, `web/src/layouts/KioskLayout.tsx`
- **Verification:**
  - `cd web && npm run build` exits 0
  - `grep -q "paper-grain" web/src/layouts/AppLayout.tsx` exits 0
  - `grep -q "paper-grain" web/src/layouts/KioskLayout.tsx` exits 0
  - `grep -q "crest" web/src/layouts/AppLayout.tsx` exits 0 (the gilded crest-dot)

---
sub_spec_id: SS-02
phase: run
depends_on: []
---

### 2. New reports backend (6 aggregations)

- **Scope:** Add 6 service methods, 6 DTOs, 6 controller routes, xUnit tests.
- **Files (create):**
  - `api/src/HamptonHawksPlantSales.Core/DTOs/Reports/DailySalesResponse.cs` (and 5 sibling files)
- **Files (modify):**
  - `api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs`
  - `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs`
  - `api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs`
  - `api/tests/HamptonHawksPlantSales.Tests/Services/ReportServiceTests.cs` (extend or new)
- **Verification:**
  - `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` exits 0
  - `cd api && dotnet test HamptonHawksPlantSales.sln --no-build --no-restore` exits 0
  - `grep -q "GetDailySalesAsync" api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs` exits 0
  - `grep -q "daily-sales" api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs` exits 0

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
---

### 3. Reports hub frontend

- **Scope:** Add 6 new report pages, rebuild `ReportsPage` as a categorized hub, register routes.
- **Files (create):**
  - `web/src/pages/reports/DailySalesPage.tsx`
  - `web/src/pages/reports/PaymentBreakdownPage.tsx`
  - `web/src/pages/reports/WalkupVsPreorderPage.tsx`
  - `web/src/pages/reports/StatusFunnelPage.tsx`
  - `web/src/pages/reports/TopMoversPage.tsx`
  - `web/src/pages/reports/OutstandingAgingPage.tsx`
- **Files (modify):**
  - `web/src/types/reports.ts` (or create if missing)
  - `web/src/api/reports.ts`
  - `web/src/pages/ReportsPage.tsx`
  - `web/src/App.tsx`
  - `web/src/layouts/AppLayout.tsx` (remove top-level "Leftover Inventory" link)
- **Verification:**
  - `cd web && npm run build` exits 0
  - All 6 new page files exist (`test -f` each)
  - `grep -q "daily-sales" web/src/App.tsx` exits 0
  - `grep -q "Sales Breakdowns" web/src/pages/ReportsPage.tsx` exits 0
  - `grep -q "Operations" web/src/pages/ReportsPage.tsx` exits 0

## Edge Cases

- **No data yet (empty database):** every new report returns an empty array / zero counts; pages render `<BotanicalEmptyState>` with a friendly "no data yet" message.
- **Date range with no orders:** same as above; do not throw.
- **Null `PaymentMethod`:** group as "Unspecified" in `GetPaymentBreakdownAsync`.
- **`AmountTendered` null on legacy orders:** treat as zero in revenue aggregations; do NOT filter out the order.
- **Soft-deleted orders/lines:** excluded everywhere via `DeletedAt == null`.
- **Draft orders:** excluded from every aggregation (matches existing precedent in `GetDashboardMetricsAsync`).
- **Status funnel total:** excludes Draft from the denominator so percentages add to 100% over real orders.
- **Outstanding aging:** if no open orders, return all four buckets with zero counts (UI hides empty buckets).

## Out of Scope

- Charts (the existing horizontal bar in `ReportsPage` stays as-is; no new chart library).
- Schema changes (every report queries existing fields).
- Per-line price overrides, refunds, tax (separate concerns).
- Realtime updates (reports are pull-on-load, refresh button only).
- PDF export (CSV is sufficient).
- Multi-currency (single currency assumed).
- Authorization on report endpoints (kept open like existing reports).

## Constraints

### Musts
- `cd api && dotnet build HamptonHawksPlantSales.sln` exits 0 after Wave 2.
- `cd api && dotnet test HamptonHawksPlantSales.sln` exits 0 after Wave 2.
- `cd web && npm run build` exits 0 after each wave.
- Every new endpoint returns `ApiResponse<T>` envelope.
- Every aggregation uses the precedent filters (`DeletedAt == null && Status != Draft`).
- Every new page wraps in `<JoyPageShell>`.

### Must-Nots
- Do NOT add migrations.
- Do NOT add charting libraries.
- Do NOT add new color tokens.
- Do NOT modify the soft-delete query filter or any global EF config.
- Do NOT change existing report DTOs (additive only).
- Do NOT touch print pages or kiosk page bodies.

### Preferences
- Prefer existing utilities (`csvExport`, `MetricCard`, `useAdminAuth`) over rolling new ones.
- Prefer LINQ-translatable expressions; avoid `AsEnumerable()` mid-query.
- Prefer table density (small text, tabular-nums) over visual breathing room — these are operations reports.

### Escalation Triggers
- Build fails and root cause is not obvious.
- An aggregation requires a schema change.
- A test fails and the cause is in existing code (escalate; don't fix unrelated bugs).

## Verification

Manual: spin up `docker compose up`, hit each new report URL, sanity-check numbers against `/api/reports/dashboard-metrics`. Confirm CSV downloads.

Automated (factory verifier or this run): per-sub-spec verification commands listed above.

## Deployment Notes

Standard deploy: rebuild `api` and `web` containers, ship. No migrations.

Rollback: revert the branch. Reports become unavailable; nothing else affected.

## Approaches Considered

- **Charts library (rejected):** would add ~100KB to the bundle and the data is more useful as exportable CSV than as inline charts.
- **GraphQL for reports (rejected):** dramatic over-engineering for 6 fixed reports.
- **Per-report database views (rejected):** fine for 5000-row scale, premature for 50000+ scale; revisit with the capacity-hardening spec.
- **One mega-report endpoint (rejected):** harder to cache, harder to URL-share, worse for CSV export.
