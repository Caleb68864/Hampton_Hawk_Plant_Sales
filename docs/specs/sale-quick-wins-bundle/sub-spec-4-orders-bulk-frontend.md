---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-03']
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Orders bulk actions -- frontend"
---

# SS-04: Orders bulk actions -- frontend

## Scope
Extend `OrdersListPage` with sortable columns (URL-param state), row selection, sticky bulk-action toolbar, and result modal. Wire admin pin via `useAdminAuth`.

## Files to Touch
- `web/src/pages/orders/OrdersListPage.tsx` (modify)
- `web/src/api/orders.ts` (modify -- add bulkComplete, bulkSetStatus)
- `web/src/types/order.ts` (modify -- BulkOperationResult, BulkOrderOutcome shapes)
- `web/src/components/orders/BulkActionToolbar.tsx` (new)
- `web/src/components/orders/BulkResultModal.tsx` (new)

## Patterns to Follow
- URL search params for list-page state: `useSearchParams` from React Router.
- Admin pin prompt: `useAdminAuth().openPinModal()` (returns `{ pin, reason }` or null).
- Existing list page: `OrdersListPage.tsx` already has filters/pagination.

## Implementation Steps

1. **Extend `web/src/api/orders.ts`** with `bulkComplete(ids: string[], pin: string, reason: string)` and `bulkSetStatus(ids: string[], targetStatus: OrderStatus, pin: string, reason: string)`.
2. **Extend `web/src/types/order.ts`** with `BulkOperationResult { outcomes: BulkOrderOutcome[] }` and `BulkOrderOutcome { orderId: string; outcome: 'Completed' | 'Skipped' | 'StatusChanged'; reason?: string }`.
3. **Update `OrdersListPage.tsx`:**
   - Add sortable column headers. Sort state read from `useSearchParams()` (`sortBy`, `sortDir`); writes to URL on click.
   - Pass sort params to API list call.
   - Add row-checkbox column and select-all in header. Track selection in component state (Set<string>).
   - When `selected.size >= 1`, render `<BulkActionToolbar selectedIds={Array.from(selected)} onComplete={...} />` sticky at top.
4. **Implement `BulkActionToolbar.tsx`** (uses `TouchButton` from SS-02 if available, else local equivalent):
   - Shows count + buttons "Mass Complete" / "Change Status...".
   - Mass Complete: `openPinModal()` -> on success `bulkComplete(ids, pin, reason)`; pass result to `BulkResultModal`.
   - Change Status: open inline dropdown -> select status -> `openPinModal()` -> `bulkSetStatus(ids, status, pin, reason)`; pass result to `BulkResultModal`.
   - Disable buttons if `ids.length > 500`; show warning text.
5. **Implement `BulkResultModal.tsx`:** table of per-order outcomes (orderNumber, outcome, reason). Close button.
6. **Refresh list** after bulk action completes (re-fetch with current filters).
7. **`npm run build`** clean.
8. **Manual smoke:** select 5 orders, Mass Complete with pin -> result modal shows per-order outcome, list refreshes.

## Interface Contracts

### Provides
- None.

### Requires
- From SS-03: `BulkOperationResult` / `BulkOrderOutcome` JSON shape; admin-pin endpoints reachable at the documented routes.
- From SS-02 (optional): `TouchButton` shared component for consistent touch-friendly buttons. If SS-02 not yet merged, fall back to project's existing button styles and refactor in a follow-up.

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| BulkActionToolbar component exists | [STRUCTURAL] | `test -f web/src/components/orders/BulkActionToolbar.tsx \|\| (echo "FAIL: BulkActionToolbar missing" && exit 1)` |
| BulkResultModal component exists | [STRUCTURAL] | `test -f web/src/components/orders/BulkResultModal.tsx \|\| (echo "FAIL: BulkResultModal missing" && exit 1)` |
| ordersApi has bulkComplete | [STRUCTURAL] | `grep -q "bulkComplete" web/src/api/orders.ts \|\| (echo "FAIL: ordersApi.bulkComplete missing" && exit 1)` |
| ordersApi has bulkSetStatus | [STRUCTURAL] | `grep -q "bulkSetStatus" web/src/api/orders.ts \|\| (echo "FAIL: ordersApi.bulkSetStatus missing" && exit 1)` |
| OrdersListPage references useSearchParams | [STRUCTURAL] | `grep -q "useSearchParams" web/src/pages/orders/OrdersListPage.tsx \|\| (echo "FAIL: OrdersListPage missing URL-param sort state" && exit 1)` |
| OrdersListPage renders BulkActionToolbar | [STRUCTURAL] | `grep -q "BulkActionToolbar" web/src/pages/orders/OrdersListPage.tsx \|\| (echo "FAIL: BulkActionToolbar not wired" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
