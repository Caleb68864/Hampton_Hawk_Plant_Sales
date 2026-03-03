---
title: "Fix: Order Line Partial Update Returns 500"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: high
failing_scenarios: [EP-04]
tags:
  - fix
  - orders
  - high
---

# Fix: Order Line Partial Update Returns 500

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: HIGH
- Failing Scenarios: EP-04

## Outcome
`PUT /api/orders/{orderId}/lines/{lineId}` accepts a partial body with only `qtyOrdered` (without requiring `plantCatalogId`) and returns HTTP 200 with the updated line.

## Context
Currently, sending `{"qtyOrdered": 5}` to update an order line throws an unhandled EF Core exception ("An error occurred while saving the entity changes") because `plantCatalogId` is missing from the body and gets set to a zero/empty GUID, which violates the foreign key constraint.

The update endpoint should preserve existing field values when they are not provided in the request body.

## Requirements
- PUT order line with only `{"qtyOrdered": 5}` succeeds and updates quantity
- `plantCatalogId` is preserved from the existing line when not provided
- PUT with both fields also continues to work
- Invalid `qtyOrdered` (0, negative) returns 400 with validation error

## Sub-Specs

### 1. Fix Order Line Update to Preserve Existing Fields
**Scope:** Load the existing line first, then apply only the provided fields from the request body.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` (or OrderLineService)
- Possibly the update DTO to make `plantCatalogId` optional/nullable
**Acceptance criteria:**
- `PUT /api/orders/{id}/lines/{lineId}` with `{"qtyOrdered": 5}` returns 200, line shows qtyOrdered=5 with original plantCatalogId
- `PUT` with `{"qtyOrdered": 5, "plantCatalogId": "..."}` also works
- Original plantCatalogId is not overwritten with empty GUID
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-04`
