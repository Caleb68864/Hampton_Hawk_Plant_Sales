# Red Team Review: Pick-List Barcode Workflow

Date: 2026-04-25
Reviewed: `docs/specs/2026-04-25-picklist-barcode-workflow.md`
Phase specs: `docs/specs/picklist-barcode-workflow/` (4 sub-specs)

## Severity Summary
- CRITICAL: 0
- ADVISORY: 5 (all auto-patched into the spec)

## Role Scorecards
Developer: 0 | QA: 1 | End User: 0 | Architect: 1 | Scope Realist: 0 | Security: 1 | SRE: 1 | Data: 1 | Product: 0

## CRITICAL Findings
None. The fulfillment reuse pattern is sound, and Draft-status filtering is explicit.

## ADVISORY Findings (all patched)

### A-1: Backfill collision risk (Data Steward)
- **Location:** SS-01 (schema + backfill)
- **Issue:** `md5(random())` substring backfill with a unique index could collide. Low probability, but a single collision fails the migration.
- **Fix applied:** Added Edge Case entry requiring the migration to handle unique-violation via retry loop or post-fill verification.

### A-2: useScanWorkflow regression risk (Architect)
- **Location:** SS-03 (frontend session flow)
- **Issue:** Parameterizing the existing scan workflow hook risks breaking the per-order path.
- **Fix applied:** Added Edge Case + acceptance criterion requiring an explicit per-order regression test post-parameterization.

### A-3: Physical pick-list security (Security)
- **Location:** Edge Cases / cheatsheet guidance
- **Issue:** A leaked printed barcode allows unauthorized scanning. Codebase doesn't auth session creation (matches existing per-order behavior).
- **Fix applied:** Added Edge Case noting paper-control as an operational responsibility, documented in cashier cheatsheet.

### A-4: Hosted service resilience (SRE)
- **Location:** SS-02 (`ScanSessionExpiryHostedService`)
- **Issue:** A `BackgroundService` loop without per-iteration error handling stalls on a single failure.
- **Fix applied:** Added `[STRUCTURAL]` criterion requiring per-iteration `try/catch` + log.

### A-5: Aggregation perf with many orders (QA)
- **Location:** SS-02
- **Issue:** A customer with many open orders may produce a large session aggregation; perf is not asserted.
- **Fix applied:** Added Edge Case requiring a perf assertion (CreateFromPicklistAsync <500ms for ≥30 orders on dev container).

## Notes (Not Patched)
- Expand-mode (multi-order ad-hoc) explicitly deferred. Off by default. Acceptable.
- The optional Sales-by-Plant report from the Quick Wins bundle is unrelated to this spec but referenced indirectly in the broader bundle.
