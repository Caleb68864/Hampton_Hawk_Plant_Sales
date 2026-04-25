---
type: phase-spec-index
master_spec: "../2026-04-25-picklist-barcode-workflow.md"
date: 2026-04-25
sub_specs: 4
---

# Pick-List Barcode Workflow -- Phase Specs

Refined from [2026-04-25-picklist-barcode-workflow.md](../2026-04-25-picklist-barcode-workflow.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| SS-01 | Pick-list barcode columns + entities + migrations | none | [sub-spec-1-schema-and-entities.md](sub-spec-1-schema-and-entities.md) |
| SS-02 | ScanSessionService -- backend logic | SS-01 | [sub-spec-2-scan-session-service.md](sub-spec-2-scan-session-service.md) |
| SS-03 | PickupLookupPage extension + PickupScanSessionPage | SS-02 | [sub-spec-3-frontend-session-flow.md](sub-spec-3-frontend-session-flow.md) |
| SS-04 | Print pages -- render pick-list barcode | SS-01 | [sub-spec-4-print-barcodes.md](sub-spec-4-print-barcodes.md) |

## Wave Plan
- Wave 1: SS-01.
- Wave 2 (parallel): SS-02, SS-04.
- Wave 3: SS-03.

## Requirement Traceability Matrix

| Requirement | Covered By |
|-------------|-----------|
| R1 (PicklistBarcode columns + backfill) | SS-01 |
| R2 (ScanSession entities) | SS-01 |
| R3 (IScanSessionService methods) | SS-02 |
| R4 (controller endpoints) | SS-02 |
| R5 (transactional scan reusing fulfillment) | SS-02 |
| R6 (Draft excluded from aggregation) | SS-02 |
| R7 (lookup recognizes PLB-/PLS-) | SS-03 |
| R8 (PickupScanSessionPage) | SS-03 |
| R9 (print pages render barcode) | SS-04 |
| R10 (auto-expire hosted service) | SS-02 |
| R11 (per-order flow unchanged) | All sub-specs (regression) |

## Execution

Run `/forge-run docs/specs/2026-04-25-picklist-barcode-workflow.md` to execute all phase specs.
