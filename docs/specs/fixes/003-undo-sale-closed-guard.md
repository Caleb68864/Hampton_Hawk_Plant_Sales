---
title: "Fix: Undo-Last-Scan Not Blocked When Sale Is Closed"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: critical
failing_scenarios: [SR-08]
tags:
  - fix
  - business-logic
  - critical
---

# Fix: Undo-Last-Scan Not Blocked When Sale Is Closed

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: CRITICAL
- Failing Scenarios: SR-08

## Outcome
`POST /api/orders/{id}/undo-last-scan` (or equivalent undo endpoint) returns HTTP 400 with a `SaleClosedBlocked` result when `saleClosed` is true. The undo is not applied and inventory is not restored.

## Context
The scan endpoint correctly blocks all scans when the sale is closed. However, the undo-last-scan endpoint does NOT check the SaleClosed setting, allowing undos to proceed even during a closed sale. This is inconsistent with the business rule that ALL scan-related operations should be frozen when the sale is closed.

The SaleClosed check pattern already exists in the scan handler -- it just needs to be replicated in the undo handler.

## Requirements
- Undo-last-scan checks the `SaleClosed` setting before processing
- If sale is closed, return HTTP 400 (or appropriate status) with `result: "SaleClosedBlocked"` or equivalent error message
- Inventory and qtyFulfilled are NOT modified when blocked
- When sale is open, undo continues to work as before

## Sub-Specs

### 1. Add SaleClosed Guard to Undo Handler
**Scope:** Add the same SaleClosed check used in the scan handler to the undo-last-scan handler.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/FulfillmentService.cs` (undo method)
- Or the controller/service that handles the undo endpoint
**Acceptance criteria:**
- Undo with saleClosed=true returns error response (not 200)
- Inventory is unchanged after blocked undo
- Undo with saleClosed=false works normally
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-08`
