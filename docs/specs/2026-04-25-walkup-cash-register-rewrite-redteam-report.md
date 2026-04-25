# Red Team Review: Walk-Up Cash Register Rewrite

Date: 2026-04-25
Reviewed: `docs/specs/2026-04-25-walkup-cash-register-rewrite.md`
Phase specs: `docs/specs/walkup-cash-register-rewrite/` (4 sub-specs)

## Severity Summary
- CRITICAL: 0
- ADVISORY: 3 (all auto-patched into the spec)

## Role Scorecards
Developer: 0 | QA: 1 | End User: 0 | Architect: 0 | Scope Realist: 0 | Security: 0 | SRE: 1 | Data: 1 | Product: 0

## CRITICAL Findings
None. The transactional contract is well specified; idempotency is explicit; admin pin coverage is appropriate.

## ADVISORY Findings (all patched)

### A-1: CustomerId nullable migration consumer audit (Data Steward)
- **Location:** SS-01 (schema additions)
- **Issue:** Making `Order.CustomerId` nullable affects every existing read that assumes non-null. Without a deliberate consumer audit, a forgotten code path may NRE in production.
- **Fix applied:** Added `[STRUCTURAL]` criterion to SS-01 requiring an audit of every CustomerId consumer with a PR-description note. Added an Edge Case entry explicitly listing the responsibility.

### A-2: Hosted service resilience (SRE)
- **Location:** Hosted expiry service (referenced from SS-02 if applicable; primarily applies to picklist spec but pattern documented here)
- **Issue:** A `BackgroundService` loop without per-iteration error handling can stall on a single bad iteration.
- **Fix applied:** Added Edge Case guidance: any future maintenance loop must catch and log per-iteration exceptions.

### A-3: scanId discipline (QA)
- **Location:** SS-03 (frontend)
- **Issue:** Idempotency depends on the client generating one fresh `scanId` per distinct scan and reusing it ONLY on HTTP retries.
- **Fix applied:** Added Edge Case requiring SS-03 to include a unit test asserting two manual scans produce two distinct scanIds; HTTP retry layer is explicitly the only re-use path.

## Notes (Not Patched)
- **Receipt printer:** out of scope; HTML print is sufficient for v1.
- **Refund flow:** out of scope; admin order edit + manual inventory adjustment remains the recovery path post-close.
- **Performance on production mini-PC:** scan latency target <250 ms under 10 stations is documented but not yet measured. Add to capacity sidecar analysis.
