---
type: phase-spec-index
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
date: 2026-04-25
sub_specs: 6
---

# Sale Quick Wins Bundle -- Phase Specs

Refined from [2026-04-25-sale-quick-wins-bundle.md](../2026-04-25-sale-quick-wins-bundle.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| SS-01 | Settings tunables -- backend foundation | none | [sub-spec-1-settings-tunables-backend.md](sub-spec-1-settings-tunables-backend.md) |
| SS-02 | Scan UX -- frontend changes | SS-01 | [sub-spec-2-scan-ux-frontend.md](sub-spec-2-scan-ux-frontend.md) |
| SS-03 | Orders bulk actions -- backend | none | [sub-spec-3-orders-bulk-backend.md](sub-spec-3-orders-bulk-backend.md) |
| SS-04 | Orders bulk actions -- frontend | SS-03 | [sub-spec-4-orders-bulk-frontend.md](sub-spec-4-orders-bulk-frontend.md) |
| SS-05 | Reports expansion -- backend | none | [sub-spec-5-reports-backend.md](sub-spec-5-reports-backend.md) |
| SS-06 | Reports expansion -- frontend | SS-05 | [sub-spec-6-reports-frontend.md](sub-spec-6-reports-frontend.md) |

## Wave Plan

- **Wave 1 (parallel):** SS-01, SS-03, SS-05 -- all backend, no inter-dependencies.
- **Wave 2 (parallel):** SS-02 (depends on SS-01), SS-04 (depends on SS-03), SS-06 (depends on SS-05).

## Requirement Traceability Matrix

| Requirement | Covered By |
|-------------|-----------|
| R1 (settings persist + admin UI) | SS-01 |
| R2 (lookup auto-jump on single exact match) | SS-02 |
| R3 (multi-scan + post-complete focus) | SS-02 |
| R3a (touch-friendly button placement) | SS-02 |
| R4 (sortable columns) | SS-04 |
| R5 (row selection + bulk-action toolbar) | SS-04 |
| R6 (bulk-complete endpoint + eligibility) | SS-03 |
| R7 (bulk-status endpoint) | SS-03 |
| R8 (bulk validation, transactions, locks) | SS-03 |
| R9 (sales-by-seller endpoint) | SS-05 |
| R10 (sales-by-customer endpoint) | SS-05 |
| R11 (sales-by-plant endpoint, optional) | SS-05 |
| R12 (report pages with sortable tables + CSV) | SS-06 |
| R13 (build/test clean) | All sub-specs |
| R14 (existing flows untouched) | All sub-specs (regression) |

## Execution

Run `/forge-run docs/specs/2026-04-25-sale-quick-wins-bundle.md` to execute all phase specs.
