---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-02']
master_spec: "../2026-04-25-walkup-cash-register-rewrite.md"
title: "WalkUpRegisterPage -- frontend"
---

# SS-03: WalkUpRegisterPage -- frontend

## Scope
Build the cash-register page that creates a draft, scans plants in, displays running total, and closes the sale. Persist `draftId` in `appStore`. Resume on reload.

## Files to Touch
- `web/src/api/walkupRegister.ts` (new)
- `web/src/types/walkupRegister.ts` (new)
- `web/src/stores/appStore.ts` (modify)
- `web/src/pages/walkup/WalkUpRegisterPage.tsx` (new)
- `web/src/pages/station/StationHomePage.tsx` (modify -- add "New Sale" + "Resume Open Tickets")
- `web/src/routes/...` (route registration `/walkup/register/:id`)

## Patterns to Follow
- API client: `web/src/api/walkup.ts`.
- ScanInput component: existing in `web/src/components/pickup/ScanInput.tsx`.
- Admin pin: `useAdminAuth().openPinModal()`.
- Touch-friendly buttons: reuse `TouchButton` from Quick Wins SS-02 if available; otherwise inline equivalent.

## Implementation Steps

1. **Add `walkupRegisterApi`** with methods: `createDraft`, `scan`, `adjustLine`, `voidLine`, `close`, `cancel`, `getOpenDrafts`.
2. **Add types** in `web/src/types/walkupRegister.ts` mirroring backend DTOs (camelCase).
3. **Extend `appStore`** with `walkUpDraftIdByWorkstation: Record<string, string>` slice + setters.
4. **Implement `WalkUpRegisterPage.tsx`:**
   - Read or create draft id on mount (resume if cached, else `createDraft`).
   - Render: top bar with workstation + draft id + total customer count for the day; a `ScanInput`-style barcode input that auto-focuses; a ticket table (plant, sku, unit price, qty, line total, void); a right rail with grand total and "Close Sale" / "Cancel Sale" buttons.
   - Each scan: `crypto.randomUUID()` -> `scanId`; call `scan({ plantBarcode, scanId })`; update local state from server response (server is authoritative).
   - On 422 (out of stock): show inline error + "Manager Override" button that opens pin modal then calls `adjustLine` with the new qty.
   - On Close Sale: open a small modal for `paymentMethod` + `amountTendered`, then call `close`. On success, navigate to receipt view (existing print page link or a simple summary).
   - On Cancel Sale: pin modal + reason, then `cancel`.
5. **Add `StationHomePage.tsx`** entries: primary "New Sale (Register)", secondary "Resume Open Tickets".
6. **Register routes** for `/walkup/register/:draftId` and `/walkup/register/new`.
7. **Build clean:** `npm run build`.
8. **End-to-end smoke** with `start.bat` running: open New Sale, scan 3 plants, close with cash $20, receipt renders.

## Interface Contracts

### Provides
- None (terminal UI).

### Requires
- From SS-02: HTTP endpoints with the documented request/response shapes; idempotency contract (client `scanId` on every scan).

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| WalkUpRegisterPage exists | [STRUCTURAL] | `test -f web/src/pages/walkup/WalkUpRegisterPage.tsx \|\| (echo "FAIL: WalkUpRegisterPage missing" && exit 1)` |
| walkupRegister API exists | [STRUCTURAL] | `test -f web/src/api/walkupRegister.ts \|\| (echo "FAIL: walkupRegister api missing" && exit 1)` |
| walkupRegister types exist | [STRUCTURAL] | `test -f web/src/types/walkupRegister.ts \|\| (echo "FAIL: walkupRegister types missing" && exit 1)` |
| App store extended | [STRUCTURAL] | `grep -q "walkUpDraftId" web/src/stores/appStore.ts \|\| (echo "FAIL: appStore missing draft slice" && exit 1)` |
| Page uses crypto.randomUUID for scanId | [STRUCTURAL] | `grep -q "randomUUID" web/src/pages/walkup/WalkUpRegisterPage.tsx \|\| (echo "FAIL: page not generating idempotency keys" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
