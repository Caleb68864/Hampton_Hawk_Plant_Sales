---
type: phase-spec-index
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
date: 2026-03-02
sub_specs: 13
---

# Hampton Hawks Plant Sales -- Phase Specs

Refined from [2026-03-02-hampton-hawks-plant-sales.md](../2026-03-02-hampton-hawks-plant-sales.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Project Scaffolding + Docker + Database Schema | none | [sub-spec-1-scaffolding.md](sub-spec-1-scaffolding.md) |
| 2 | Core Entity Services + CRUD API | 1 | [sub-spec-2-crud-api.md](sub-spec-2-crud-api.md) |
| 3 | Import System (CSV/Excel) | 2 | [sub-spec-3-import-system.md](sub-spec-3-import-system.md) |
| 4 | Scan + Fulfillment Engine | 2 | [sub-spec-4-fulfillment-engine.md](sub-spec-4-fulfillment-engine.md) |
| 5 | Walk-Up Orders + Inventory Protection | 4 | [sub-spec-5-walkup-orders.md](sub-spec-5-walkup-orders.md) |
| 6 | Settings + SaleClosed + Reports API | 2 | [sub-spec-6-settings-reports.md](sub-spec-6-settings-reports.md) |
| 7 | React SPA Shell + Routing + Global UX | 1 | [sub-spec-7-spa-shell.md](sub-spec-7-spa-shell.md) |
| 8 | CRUD Pages | 7, 2 | [sub-spec-8-crud-pages.md](sub-spec-8-crud-pages.md) |
| 9 | Pickup Scan Screen | 7, 4 | [sub-spec-9-pickup-scan.md](sub-spec-9-pickup-scan.md) |
| 10 | Printing | 8 | [sub-spec-10-printing.md](sub-spec-10-printing.md) |
| 11 | Import UI + Walk-Up UI | 8, 3, 5 | [sub-spec-11-import-walkup-ui.md](sub-spec-11-import-walkup-ui.md) |
| 12 | Documentation | 9, 10 | [sub-spec-12-documentation.md](sub-spec-12-documentation.md) |
| 13 | Backend Tests | 4, 5 | [sub-spec-13-backend-tests.md](sub-spec-13-backend-tests.md) |

## Execution Order

```
Layer 0 (parallel): Sub-spec 1
Layer 1 (parallel): Sub-spec 2, Sub-spec 7
Layer 2 (parallel): Sub-spec 3, Sub-spec 4, Sub-spec 6
Layer 3 (parallel): Sub-spec 5, Sub-spec 8, Sub-spec 9
Layer 4 (parallel): Sub-spec 10, Sub-spec 11, Sub-spec 13
Layer 5: Sub-spec 12
```

Run `/forge-run docs/specs/hampton-hawks-plant-sales/` to execute all phase specs.
Run `/forge-run docs/specs/hampton-hawks-plant-sales/ --sub N` to execute a single sub-spec.
