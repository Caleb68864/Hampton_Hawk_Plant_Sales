---
scenario_id: "SR-02"
title: "Spec requirement: AvailableForWalkup calculation across order statuses"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
---

# Scenario SR-02: Spec requirement -- AvailableForWalkup calculation across order statuses

## Description
Validates the specification requirement that `AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled)`. The sum includes only non-walk-up orders that are not cancelled and not soft-deleted. Orders at every non-cancelled status (Open, InProgress, Complete) contribute their unfulfilled quantities.

## Preconditions
- API is running at http://localhost:8080 or EF Core InMemory test context available
- Test creates its own isolated data

## Steps

1. Create a plant `SR02 Plant` with `IsActive=true`. Store `$PLANT_ID`.
2. Set inventory with `onHandQty: 20`.
3. Create a customer. Store `$CUSTOMER_ID`.
4. Create the following non-walk-up preorders, each with one line for `$PLANT_ID`:
   - Order A (Status=Open): `qtyOrdered=5, qtyFulfilled=0` -> unfulfilled=5
   - Order B (Status=InProgress): `qtyOrdered=6, qtyFulfilled=2` -> unfulfilled=4
   - Order C (Status=Complete): `qtyOrdered=4, qtyFulfilled=4` -> unfulfilled=0
   - Order D (Status=Cancelled): `qtyOrdered=10, qtyFulfilled=0` -> unfulfilled=10 (excluded)
   - Order E (Soft-deleted, Status=Open): `qtyOrdered=3, qtyFulfilled=0` -> unfulfilled=3 (excluded)
5. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`.
6. Assert `data.onHandQty` equals `20`.
7. Assert `data.preorderRemaining` equals `9` (5 from A + 4 from B + 0 from C; D excluded as cancelled, E excluded as soft-deleted).
8. Assert `data.availableForWalkup` equals `11` (20 - 9).

## Expected Results
- Only Open and InProgress orders with unfulfilled quantities contribute to the preorder sum
- Cancelled orders are excluded
- Soft-deleted orders are excluded
- Complete orders with zero unfulfilled contribute nothing
- `AvailableForWalkup = 20 - 9 = 11`

## Execution Tool
bash -- `cd api && dotnet test --filter "SR02_WalkUpAvailableCalculation"`

## Pass / Fail Criteria
- **Pass:** `availableForWalkup` is `11`, confirming cancelled and soft-deleted orders are excluded, and fully fulfilled orders contribute zero.
- **Fail:** Cancelled or soft-deleted orders are included in the sum, or the availability calculation is wrong.
