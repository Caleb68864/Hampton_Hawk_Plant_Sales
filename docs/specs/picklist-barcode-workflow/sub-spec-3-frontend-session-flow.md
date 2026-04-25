---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
master_spec: "../2026-04-25-picklist-barcode-workflow.md"
title: "PickupLookupPage extension + PickupScanSessionPage"
---

# SS-03: Frontend session flow

## Scope
Detect `PLB-`/`PLS-` at lookup; create session; navigate to a new session scan page that reuses scan UI + parameterized `useScanWorkflow`.

## Files to Touch
- `web/src/utils/orderLookup.ts` (modify)
- `web/src/api/scanSessions.ts` (new)
- `web/src/types/scanSession.ts` (new)
- `web/src/pages/pickup/PickupLookupPage.tsx` (modify)
- `web/src/pages/pickup/PickupScanSessionPage.tsx` (new)
- `web/src/hooks/useScanWorkflow.ts` (parameterize)
- `web/src/routes/...` (route registration)

## Implementation Steps

1. **Add helpers** in `orderLookup.ts`: `looksLikeBuyerPicklist(value)` returns true if normalized matches `^PLB-[A-Z0-9]{4,}$`; `looksLikeStudentPicklist(value)` for `PLS-...`.
2. **Add types** in `web/src/types/scanSession.ts` mirroring backend DTOs.
3. **Add `scanSessionsApi`** with `create`, `get`, `scan`, `close`, `expand`.
4. **Update `PickupLookupPage.tsx`:** in the search-change effect, if `looksLikeBuyerPicklist` or `looksLikeStudentPicklist` is true and length is full, call `scanSessionsApi.create({ scannedBarcode, workstationName })` and navigate to `/pickup/session/{id}` on success.
5. **Parameterize `useScanWorkflow.ts`:** accept `mode: 'order' | 'session'` and `id: string`. Internally route API calls accordingly. Keep existing per-order behavior intact for `mode: 'order'`.
6. **Implement `PickupScanSessionPage.tsx`:**
   - Read sessionId from `useParams`.
   - Use `useScanWorkflow({ mode: 'session', id: sessionId })`.
   - Render: header showing entity name + included order chips (link to `/orders/{id}` for each); `ScanInput`; `ItemsRemainingCounter` for aggregated total; `ScanFeedbackBanner`; `ScanHistoryList`; "End and return" button.
   - On scan, the response includes the result classification (`Accepted`, `AlreadyFulfilled`, `NotInSession`, etc.); render appropriate banner.
7. **Register route** `/pickup/session/:id`.
8. **Verify regression:** existing per-order scan path `/pickup/{orderId}` still works.
9. **`npm run build`** clean.

## Interface Contracts

### Provides
- None.

### Requires
- From SS-02: `/api/scan-sessions/*` endpoints; result classification enum.

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Picklist helpers added | [STRUCTURAL] | `grep -q "looksLikeBuyerPicklist" web/src/utils/orderLookup.ts \|\| (echo "FAIL: picklist helpers missing" && exit 1)` |
| scanSessions API exists | [STRUCTURAL] | `test -f web/src/api/scanSessions.ts \|\| (echo "FAIL: scanSessions api missing" && exit 1)` |
| PickupScanSessionPage exists | [STRUCTURAL] | `test -f web/src/pages/pickup/PickupScanSessionPage.tsx \|\| (echo "FAIL: session page missing" && exit 1)` |
| useScanWorkflow parameterized | [STRUCTURAL] | `grep -q "mode" web/src/hooks/useScanWorkflow.ts \|\| (echo "FAIL: useScanWorkflow not parameterized for session mode" && exit 1)` |
| PickupLookupPage detects PLB/PLS | [STRUCTURAL] | `grep -q "looksLikeBuyerPicklist\\|looksLikeStudentPicklist" web/src/pages/pickup/PickupLookupPage.tsx \|\| (echo "FAIL: lookup not detecting picklist prefixes" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
