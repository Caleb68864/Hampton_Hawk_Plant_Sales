# Report Charts + Pick-List Printing

## Meta
- Date: 2026-04-26
- Author: Caleb Bennett (drafted with Claude during AFK build)
- Workflow: manual forge run

## Outcome
Two complementary lifts:

1. **Reports become scannable at a glance.** Each new report page gains lightweight inline SVG/CSS visualizations: sparklines for trends, donuts for ratios, horizontal stacked bars for funnels, traffic-light vertical bars for aging, inline progress bars in row tables for top movers. No chart library — pure SVG + Tailwind. The Reports hub gets a sparkline-trend card per top metric.
2. **Sellers and customers can have their pick lists printed in one click.** SellerDetailPage gets a "Print Pick List" button linking to the existing `/print/seller/:sellerId`. CustomerDetailPage gets a new "Print Pick List" button linking to a new `PrintCustomerPickListPage` at `/print/customer/:customerId` that aggregates one customer's orders into a print-friendly layout. CustomersListPage and SellersListPage gain per-row print actions for fast bulk printing.

## Intent
- **Visual encoding over numbers-only.** A volunteer should glance at "Outstanding Aging" and see the >7d bar tower over the others without reading the count.
- **No chart library.** Bundle stays lean; we use inline SVG for trends/donuts and CSS divs for bars. Easier to print, easier to maintain, easier to style with hawk/gold tokens.
- **One-click printing from where work happens.** Volunteers shouldn't need to know the URL pattern. Detail pages and list pages get explicit print actions.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Reports charts + visualizations

**Files (create):**
- `web/src/components/reports/Sparkline.tsx` — small SVG path component, takes `points: number[]`, `width`, `height`, `stroke` color (default hawk-700), `fill` opacity area below the line. Honors `prefers-reduced-motion`.
- `web/src/components/reports/Donut.tsx` — SVG donut chart, takes `segments: { label, value, color }[]`, `size` (default 120), `centerLabel` + `centerValue` slot.
- `web/src/components/reports/HorizontalBarRow.tsx` — div-based bar (`bg-hawk-100` track + colored fill), takes `value`, `max`, `color` (default hawk-500). Used inline in tables.
- `web/src/components/reports/StackedBar.tsx` — full-width div with stacked colored segments labelled inline. Used for status funnel.
- `web/src/components/reports/AgingBarChart.tsx` — 4 vertical bars side-by-side, color-coded (`<24h` green, `1-3d` blue, `3-7d` amber, `>7d` red), value labels on top.

**Files (modify):**
- `web/src/pages/reports/DailySalesPage.tsx` — above the table, add a 2-column layout: left = `Sparkline` of revenue per day (or item count if revenue is zero), right = `Sparkline` of order count per day. Use the existing data series.
- `web/src/pages/reports/StatusFunnelPage.tsx` — above the table, render a `StackedBar` showing each status as a percentage of total, color per status (Open=hawk-500, InProgress=gold-500, Complete=green-500, Cancelled=red-500, etc).
- `web/src/pages/reports/TopMoversPage.tsx` — in the table, add a new column "Visual" that shows `HorizontalBarRow` with `value=qtyOrdered, max=topRowValue, color=hawk-500`. Insert before "Order Count".
- `web/src/pages/reports/OutstandingAgingPage.tsx` — above the bucket table, render `AgingBarChart` showing the 4 buckets visually. Keep the existing red/amber callout below it.
- `web/src/pages/reports/PaymentBreakdownPage.tsx` — above the table, render a `Donut` of revenue per method (or order count if all revenue is zero). Empty state: skip the donut.
- `web/src/pages/reports/WalkupVsPreorderPage.tsx` — replace the plain ratio callout with a prominent `Donut` (`segments: [{label: 'WalkUp', value: walkUp.orderCount, color: gold}, {label: 'Preorder', value: preorder.orderCount, color: hawk}]`, `centerLabel: 'WalkUp Share'`, `centerValue: '{n}%'`). Keep the two channel summary cards below.
- `web/src/pages/ReportsPage.tsx` — keep the existing horizontal bar; no other changes (the categorized hub is already visual enough).

**Verification:**
- `cd web && npm run build` exits 0
- `test -f web/src/components/reports/Sparkline.tsx` and similar for the other 4 components
- `grep -q "Sparkline" web/src/pages/reports/DailySalesPage.tsx` exits 0
- `grep -q "Donut" web/src/pages/reports/WalkupVsPreorderPage.tsx` exits 0
- `grep -q "AgingBarChart" web/src/pages/reports/OutstandingAgingPage.tsx` exits 0
- `grep -q "StackedBar" web/src/pages/reports/StatusFunnelPage.tsx` exits 0

---
sub_spec_id: SS-02
phase: run
depends_on: []
---

### 2. Pick-list printing entry points + customer pick list page

**Files (create):**
- `web/src/pages/print/PrintCustomerPickListPage.tsx` — new page at `/print/customer/:customerId`. Reads URL params (`returnTo` like other print pages). Loads customer by id, loads the customer's orders (use `ordersApi.list({ customerId })` or equivalent), aggregates lines per plant across orders, renders:
  - Print header (use `PrintHeader` component) with customer name + pickup code
  - **Customer picklist barcode at the TOP of the first page** — this is the scannable PLB- barcode that triggers the SS-08 `ScanSessionService.CreateAsync` flow at the pickup station. Render via `<OrderNumberBarcode value={customer.picklistBarcode} variant="bare" />` inside a `data-picklist-barcode` div, **mirroring the exact pattern in `PrintSellerPacketPage.tsx:171-176`**. Without this barcode at the top of the page, the print is useless — the whole point is one-scan order pull at the pick station.
  - Conditional fallback: if `customer.picklistBarcode` is empty (legacy customers from before SS-06 migration), render a small note "No pick-list barcode — admin must regenerate via Customers page" instead of crashing.
  - "Pick List" title
  - Aggregated plants table: `Plant Name | SKU | Qty Ordered | Qty Fulfilled | Notes`
  - Per-order breakdown section below (one card per order: order number, status, lines, with the order's own barcode visible too so a single order can also be scanned individually)
  - Picklist barcode **also rendered at the BOTTOM of the last page** (mirrors `PrintSellerPacketPage.tsx:234-236`) so a stack of packets can be scanned from the back without flipping
  - Print footer
  - Filter controls (NOT printed): includePreorders, includeWalkups, includeCompleted (default false), sortBy
  - Use `PrintLayout` wrapper. Match `PrintSellerPacketPage` patterns closely.

**Files (modify):**
- `web/src/App.tsx` — register `/print/customer/:customerId` route
- `web/src/utils/printRoutes.ts` — add `buildPrintCustomerPickListPath(customerId, returnTo)` matching the existing `buildPrintSellerPacketPath` pattern
- `web/src/pages/customers/CustomerDetailPage.tsx` — in the actions slot of `JoyPageShell`, add a `TouchButton` "Print Pick List" that calls `openPrintWindow(buildPrintCustomerPickListPath(customer.id, '/customers/' + customer.id))`. Use `gold` variant or default primary.
- `web/src/pages/sellers/SellerDetailPage.tsx` — in the actions slot of `JoyPageShell`, add a `TouchButton` "Print Seller Packet" that calls `openPrintWindow(buildPrintSellerPacketPath(seller.id, '/sellers/' + seller.id))`. The existing route already works.
- `web/src/pages/customers/CustomersListPage.tsx` — add a small "Print" button to each row (icon-only or compact text). Opens the customer pick list in a new window.
- `web/src/pages/sellers/SellersListPage.tsx` — add a small "Print" button to each row that opens the seller packet.
- `web/src/utils/printWindow.ts` (or wherever `openPrintWindow` lives) — confirm it's exported; if not, extract from `LookupPrintStationPage`.

**Verification:**
- `cd web && npm run build` exits 0
- `test -f web/src/pages/print/PrintCustomerPickListPage.tsx`
- `grep -q "print/customer/:customerId" web/src/App.tsx`
- `grep -q "buildPrintCustomerPickListPath" web/src/utils/printRoutes.ts`
- `grep -q "Print Pick List" web/src/pages/customers/CustomerDetailPage.tsx`
- `grep -q "Print Seller Packet" web/src/pages/sellers/SellerDetailPage.tsx`
- `grep -q "picklistBarcode" web/src/pages/print/PrintCustomerPickListPage.tsx` — confirms the scannable barcode is included
- `grep -q "data-picklist-barcode" web/src/pages/print/PrintCustomerPickListPage.tsx` — confirms it follows the seller packet pattern

## Edge Cases
- **No orders for customer:** print page renders the header + an empty "no orders to pick" message; no table.
- **All filters off:** show empty state, do not crash.
- **Soft-deleted orders:** excluded by default (matches existing API).
- **Empty data on report charts:** charts skip render if all values are zero; tables still render with empty-state message.
- **Sparkline with one data point:** renders a single dot, no line.
- **Donut with one segment:** renders as full circle.
- **Aging chart with all-zero buckets:** renders four empty grey bars (visual continuity).

## Out of Scope
- Backend changes (every chart uses existing `/api/reports/...` endpoints).
- New API endpoints for the customer pick list (use existing `ordersApi.list({ customerId })` or equivalent client-side filter).
- Charting library adoption.
- Saving pick-list view state.
- Bulk select print on list pages.
- PDF export.

## Constraints
### Musts
- `cd web && npm run build` exits 0 after each sub-spec.
- Charts honor `prefers-reduced-motion: reduce` (no transitions/animations on render).
- All new chart components are pure presentational (no API calls).
- `PrintCustomerPickListPage` follows the exact patterns in `PrintSellerPacketPage` (PrintLayout wrapper, PrintHeader, PrintFooter, returnTo param).

### Must-Nots
- No new dependencies.
- No edits to backend/controllers/services.
- No edits to `joy.css`/`index.css`/`main.tsx`.
- No new color tokens.

### Preferences
- Prefer SVG for line/donut/sparkline; CSS divs for bar charts (printable, no SVG quirks).
- Prefer hawk/gold/red/amber/green from existing palette.
- Prefer `tabular-nums` on all chart labels.
