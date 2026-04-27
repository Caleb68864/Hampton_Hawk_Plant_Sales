---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-05']
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Reports expansion -- frontend"
---

# SS-06: Reports expansion -- frontend

## Scope
Add new report pages with sortable tables and CSV export. Link them from `ReportsPage`.

## Files to Touch
- `web/src/api/reports.ts` (modify)
- `web/src/types/reports.ts` (modify)
- `web/src/pages/reports/SalesBySellerPage.tsx` (new)
- `web/src/pages/reports/SalesByCustomerPage.tsx` (new)
- `web/src/pages/reports/SalesByPlantPage.tsx` (new -- optional)
- `web/src/pages/ReportsPage.tsx` (modify)
- `web/src/utils/csvExport.ts` (new helper)
- `web/src/routes/...` (route registration)

## Patterns to Follow
- Existing reports page: see `ReportsPage.tsx` with `Promise.allSettled` + dashboard metrics.
- Existing leftover inventory page: `web/src/pages/reports/LeftoverInventoryPage.tsx` -- mirror its layout.
- Tailwind classes consistent with other pages.

## Implementation Steps

1. **Extend `web/src/api/reports.ts`** with `salesBySeller()`, `salesByCustomer()`, `salesByPlant()` methods.
2. **Extend `web/src/types/reports.ts`** with `SalesBySellerRow`, `SalesByCustomerRow`, `SalesByPlantRow` types.
3. **Implement `web/src/utils/csvExport.ts`** -- helper `exportToCsv(filename: string, rows: object[], headers: string[])` that builds a UTF-8-with-BOM CSV blob and triggers download.
4. **Implement `SalesBySellerPage.tsx`:**
   - Fetch on mount via `salesBySeller()`.
   - Render sortable table (column click toggles asc/desc).
   - "Download CSV" button calls `exportToCsv`.
5. **Implement `SalesByCustomerPage.tsx`** identically with customer-keyed rows.
6. **Implement `SalesByPlantPage.tsx`** if SS-05 ships the endpoint; otherwise mark optional.
7. **Update `ReportsPage.tsx`:** add "Sales Breakdowns" section with cards linking to the new pages.
8. **Register routes** in router: `/reports/sales-by-seller`, `/reports/sales-by-customer`, `/reports/sales-by-plant`.
9. **Manual smoke:** visit each page, sort by revenue, click Download CSV, open in Excel.

## Interface Contracts

### Provides
- None.

### Requires
- From SS-05: API endpoints reachable; row DTOs match the documented shape (camelCase JSON: `sellerId`, `sellerDisplayName`, `orderCount`, etc.).

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| reportsApi has salesBySeller | [STRUCTURAL] | `grep -q "salesBySeller" web/src/api/reports.ts \|\| (echo "FAIL: reportsApi.salesBySeller missing" && exit 1)` |
| SalesBySellerPage exists | [STRUCTURAL] | `test -f web/src/pages/reports/SalesBySellerPage.tsx \|\| (echo "FAIL: SalesBySellerPage missing" && exit 1)` |
| SalesByCustomerPage exists | [STRUCTURAL] | `test -f web/src/pages/reports/SalesByCustomerPage.tsx \|\| (echo "FAIL: SalesByCustomerPage missing" && exit 1)` |
| csvExport helper exists | [STRUCTURAL] | `test -f web/src/utils/csvExport.ts \|\| (echo "FAIL: csvExport util missing" && exit 1)` |
| ReportsPage links to new pages | [STRUCTURAL] | `grep -q "Sales Breakdowns" web/src/pages/ReportsPage.tsx \|\| (echo "FAIL: ReportsPage missing Sales Breakdowns section" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
