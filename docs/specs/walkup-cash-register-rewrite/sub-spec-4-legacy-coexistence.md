---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-03']
master_spec: "../2026-04-25-walkup-cash-register-rewrite.md"
title: "Coexistence with legacy walk-up + station home updates"
---

# SS-04: Legacy coexistence + station home updates

## Scope
Keep the existing `WalkUpNewOrderPage` and `/api/walkup/orders/...` endpoints working for one release. Update station home so the new register is the primary action. Add a cheatsheet doc.

## Files to Touch
- `web/src/pages/station/StationHomePage.tsx` (modify)
- `web/src/pages/walkup/WalkUpNewOrderPage.tsx` (modify -- add "Legacy form" banner)
- `docs/cheatsheets/walkup-register.md` (new)

## Implementation Steps

1. Add a non-blocking yellow banner to `WalkUpNewOrderPage` reading "Legacy form -- use the Register for new sales. This form remains available as a fallback."
2. Update `StationHomePage`: primary CTA "New Sale (Register)" -> `/walkup/register/new`; secondary "Old Walk-Up Form (legacy)" -> `/walkup/new-order` (existing route).
3. Write `docs/cheatsheets/walkup-register.md` covering:
   - Starting a sale.
   - Scanning + override flow.
   - Closing a sale.
   - Cancelling a sale.
   - When to use the legacy form (only as a fallback if the register fails).
4. `npm run build` clean.

## Interface Contracts

### Provides
- None.

### Requires
- From SS-03: `/walkup/register/new` route exists.

## Verification Commands

```sh
cd web
npm run build
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Cheatsheet exists | [STRUCTURAL] | `test -f docs/cheatsheets/walkup-register.md \|\| (echo "FAIL: walkup-register cheatsheet missing" && exit 1)` |
| Legacy banner present | [STRUCTURAL] | `grep -q "Legacy form" web/src/pages/walkup/WalkUpNewOrderPage.tsx \|\| (echo "FAIL: legacy banner missing" && exit 1)` |
| Station home references register | [STRUCTURAL] | `grep -q "walkup/register" web/src/pages/station/StationHomePage.tsx \|\| (echo "FAIL: station home not linking to register" && exit 1)` |
| Frontend builds | [MECHANICAL] | `cd web && npm run build \|\| (echo "FAIL: web build failed" && exit 1)` |
