---
scenario_id: "DB-06"
title: "Reject QtyOrdered update below QtyFulfilled"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - data
---

# Scenario DB-06: Reject QtyOrdered update below QtyFulfilled

## Description
Verifies that updating an order line's `QtyOrdered` to a value less than its current `QtyFulfilled` is rejected with a validation error. This prevents data inconsistency where fulfilled quantity would exceed ordered quantity.

## Preconditions
- API is running at http://localhost:8080
- The order must have a line with `QtyFulfilled > 0` (achieved by scanning barcodes)
- Steps must run in order

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"DB06 Orchid","sku":"DB06-ORCH","barcode":"BC-DB06","price":8.00,"isActive":true}`. Store `$PLANT_ID`.
2. Set inventory with `plantCatalogId: $PLANT_ID` and `onHandQty: 10`.
3. Create a customer. Store `$CUSTOMER_ID`.
4. Create an order via `POST /api/orders` with one line: `{"plantCatalogId":"$PLANT_ID","qtyOrdered":5}`. Store `data.id` as `$ORDER_ID`.
5. Get the order. Store the first line's `id` as `$LINE_ID`.
6. Scan the barcode 3 times via `POST /api/orders/$ORDER_ID/scan` with `{"barcode":"BC-DB06"}` to set `QtyFulfilled` to 3.
7. Verify by calling `GET /api/orders/$ORDER_ID` that the line has `qtyFulfilled: 3`.
8. Attempt to update the line via `PUT /api/orders/$ORDER_ID/lines/$LINE_ID` with `{"qtyOrdered": 2}` (less than fulfilled 3).
9. Assert the response indicates failure: either HTTP 400 with `success: false` or an error message indicating that `QtyOrdered` cannot be less than `QtyFulfilled`.
10. Verify by calling `GET /api/orders/$ORDER_ID` that the line still has `qtyOrdered: 5` (unchanged).
11. Attempt to update the line with `{"qtyOrdered": 3}` (equal to fulfilled).
12. Assert the response succeeds: HTTP 200 with `success: true`.
13. Verify the line now has `qtyOrdered: 3`.

## Expected Results
- Setting `qtyOrdered` to 2 (below `qtyFulfilled` of 3) is rejected with an error
- The original `qtyOrdered` of 5 remains unchanged after the rejected update
- Setting `qtyOrdered` to 3 (equal to `qtyFulfilled`) is allowed

## Execution Tool
bash -- `cd api && dotnet test --filter "DB06_OrderLineQtyBelowFulfilled"`

## Pass / Fail Criteria
- **Pass:** Update to qty below fulfilled is rejected, original value is preserved, and update to qty equal to fulfilled succeeds.
- **Fail:** The update below fulfilled is accepted, or the update equal to fulfilled is rejected, or the original value changes after a rejected update.
