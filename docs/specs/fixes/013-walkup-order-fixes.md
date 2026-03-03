---
title: "Fix: Walk-Up Order Creation, Inventory Protection, and Admin Override"
project: "Hampton Hawks Plant Sales"
date: 2026-03-03
type: spec
severity: high
failing_scenarios: [EP-14, EP-15, SR-14, SR-15]
tags:
  - fix
  - walkup
  - inventory
  - high
---

# Fix: Walk-Up Order Creation, Inventory Protection, and Admin Override

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-03
- Author: Forge
- Severity: HIGH
- Failing Scenarios: EP-14, EP-15, SR-14, SR-15

## Outcome
1. Walk-up availability endpoint lists ALL plants with their available-for-walkup quantities (not just a single plant).
2. Walk-up order line creation via `/api/walkup/orders/{id}/lines` correctly binds `qtyOrdered` from the request body.
3. The standard `/api/orders/{id}/lines` endpoint applies walk-up inventory protection when the order has `IsWalkUp=true`.
4. Admin PIN override on walk-up lines sets `HasIssue=true` on the order and the override is logged.
5. Availability recalculates after walk-up lines are added.

## Context
Four related walk-up order issues:

1. **EP-14 (Walk-up order creation):** The `GET /api/walkup/availability` endpoint only accepts a single `plantCatalogId` query param. Tests expect it to return a LIST of all plants with availability when no param is provided. Also, tests send `qty` in the request body but the `AddWalkUpLineRequest` DTO expects `qtyOrdered` -- this may cause the quantity to default to 0.

2. **EP-15 (Walk-up inventory protection):** Tests create preorders via standard `/api/orders` endpoints, then use `/api/walkup/` for walk-up operations. The protection logic in `WalkUpService` is correct (it calls `_protection.ValidateWalkupLineAsync()`), but the `WalkUpAvailabilityResponse` DTO doesn't populate `PlantName`, `PlantSku`, `OnHandQty`, or `PreorderRemaining` -- only `AvailableForWalkup` is set.

3. **SR-14 (Walk-up blocked when exceeding inventory):** Tests use `POST /api/orders/{walkupId}/lines` (the standard orders endpoint) to add lines to walk-up orders. The standard `OrdersController.AddLine` does NOT call `InventoryProtectionService`, so walk-up lines added through this route bypass protection entirely.

4. **SR-15 (Admin override sets HasIssue):** Same endpoint mismatch as SR-14. When lines are added via the standard orders endpoint, no admin PIN check or HasIssue flag is set. The `WalkUpController.AddLine` has the correct logic but the test uses the wrong route.

### Root Cause Analysis
The `WalkUpController` correctly implements inventory protection and admin override. However:
- The availability endpoint is incomplete (single-plant only, missing fields)
- The standard `OrdersController.AddLine` has no awareness of walk-up protection
- Both routes should work for adding lines to walk-up orders

## Requirements
- `GET /api/walkup/availability` with no params returns all active plants with `plantCatalogId`, `plantName`, `plantSku`, `onHandQty`, `preorderRemaining`, `availableForWalkup`
- `GET /api/walkup/availability?plantCatalogId={id}` returns a single plant's availability (existing behavior, enhanced)
- `POST /api/walkup/orders/{id}/lines` correctly reads `qtyOrdered` from request body (value must not default to 0)
- `POST /api/orders/{id}/lines` for walk-up orders (`isWalkUp=true`) applies the same inventory protection as `/api/walkup/orders/{id}/lines`
- Walk-up line that exceeds available inventory without admin PIN returns HTTP 400
- Walk-up line with valid admin PIN + reason succeeds and sets `hasIssue=true` on the order
- Availability quantity decreases after walk-up lines are added

## Sub-Specs

### 1. Enhance Walk-Up Availability Endpoint
**Scope:** Modify `GET /api/walkup/availability` to return all plants when no `plantCatalogId` is provided. Populate all DTO fields.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpController.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/InventoryProtectionService.cs` (add a method to get all availability)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IInventoryProtectionService.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/WalkUpDtos.cs` (ensure all fields are populated)
**Acceptance criteria:**
- `GET /api/walkup/availability` (no params) returns list of all active plants with `availableForWalkup`, `plantName`, `plantSku`, `onHandQty`, `preorderRemaining`
- `GET /api/walkup/availability?plantCatalogId={id}` returns single-plant availability with all fields populated
- Available quantity = onHandQty - (sum of qtyOrdered for non-walkup, non-complete orders)
**Dependencies:** none

### 2. Add Walk-Up Inventory Protection to Standard Orders Endpoint
**Scope:** When adding a line to an order with `IsWalkUp=true` via `POST /api/orders/{id}/lines`, apply the same inventory protection and admin override logic used in `WalkUpController.AddLine`.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs` (AddLine action)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/OrderService.cs` (AddLineAsync or equivalent)
**Acceptance criteria:**
- `POST /api/orders/{walkupOrderId}/lines` with `qtyOrdered: 5` (exceeding available=2) returns HTTP 400 with error message
- `POST /api/orders/{walkupOrderId}/lines` with `qtyOrdered: 2` (at limit) succeeds with HTTP 200
- `POST /api/orders/{walkupOrderId}/lines` with `qtyOrdered: 5` + admin PIN headers returns HTTP 200 and sets `hasIssue=true` on order
- Non-walkup orders continue to work without inventory protection
**Dependencies:** 1

### 3. Ensure Walk-Up Line QtyOrdered Binds Correctly
**Scope:** Verify and fix the `AddWalkUpLineRequest` DTO binding. If testers send `qty` instead of `qtyOrdered`, consider adding a JSON alias or rename the field to match API convention.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Core/DTOs/WalkUpDtos.cs`
**Acceptance criteria:**
- `POST /api/walkup/orders/{id}/lines` with `{"plantCatalogId":"...","qtyOrdered":2}` creates line with `qtyOrdered=2` (not 0)
- `POST /api/walkup/orders/{id}/lines` with `{"plantCatalogId":"...","qty":2}` also works (alias)
**Dependencies:** none

## Edge Cases
- Adding a walk-up line to a non-existent order returns 404
- Adding a walk-up line with qty=0 or negative returns 400
- Admin override with wrong PIN returns 403 or 400
- Availability for a plant with no inventory record shows 0

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-14`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-15`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-14`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-15`
