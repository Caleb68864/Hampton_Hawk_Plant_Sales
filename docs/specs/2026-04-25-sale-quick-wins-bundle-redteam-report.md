# Red Team Review: Sale Quick Wins Bundle

Date: 2026-04-25
Reviewed: `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
Phase specs: `docs/specs/sale-quick-wins-bundle/` (6 sub-specs)

## Severity Summary
- CRITICAL: 0
- ADVISORY: 4 (all auto-patched into the spec)

## Role Scorecards
Developer: 0 | QA: 1 | End User: 0 | Architect: 1 | Scope Realist: 0 | Security: 1 | SRE: 1 | Data: 0 | Product: 0

## CRITICAL Findings
None.

## ADVISORY Findings (all patched)

### A-1: TouchButton coordination across waves (Architect)
- **Location:** SS-02 (provides) + SS-04 (optional consumer)
- **Issue:** SS-02 introduces a shared `TouchButton` component. SS-04 references it as optional with a fallback. Parallel waves could land them inconsistently.
- **Fix applied:** Added an Edge Cases note: SS-04 may define the same min-hit-target classes locally if SS-02 is delayed. Tolerant fallback is the preferred path.

### A-2: Bulk operation observability (SRE)
- **Location:** SS-03 (Orders bulk backend)
- **Issue:** Bulk operations have no required logging. 3-AM diagnosis is harder without a clear log trail.
- **Fix applied:** Added `[BEHAVIORAL]` criterion requiring a Serilog `Information` log per bulk request with action type, counts, and admin reason; added Edge Case note describing the log shape.

### A-3: CSV exports may contain PII (Security)
- **Location:** SS-06 (Reports frontend)
- **Issue:** `Sales by Buyer` CSV includes customer names + revenue. Reports endpoints aren't admin-gated (matches existing pattern), but a downloaded CSV is harder to control.
- **Fix applied:** Added Edge Case note: cheatsheet should advise admins not to forward these CSVs to non-admins. No auth change in this design.

### A-4: Report query indexes (Data Steward)
- **Location:** SS-05 (Reports backend)
- **Issue:** No explicit verification that `Orders.SellerId` and `Orders.CustomerId` are indexed; report queries depend on these joins.
- **Fix applied:** Added `[INFRASTRUCTURE]` criterion requiring index verification (with optional migration if missing).

## Notes (Not Patched)
- **Bulk-cap perf testing:** the design specifies 500 orders/call. Production-target mini-PC perf is not proven. Recommendation: smoke test on the production hardware once a sale-day-sized dataset exists. Not blocking.
- **Settings cache reload:** documented as out of scope for live broadcast; the cheatsheet path is acceptable for a 10-station sale.
