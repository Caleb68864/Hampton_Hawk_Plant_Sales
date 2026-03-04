---
scenario_id: "EP-15"
title: "Get walk-up availability with preorder deduction"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - walkup
---

# Scenario EP-15: Get walk-up availability with preorder deduction

## Description
Verifies that `GET /api/walkup/availability` returns the correct `availableForWalkup` value when a plant has on-hand inventory and unfulfilled preorder quantities. With 10 on hand and 3 preorder unfulfilled, availability should be 7.

## Preconditions
- API is running at http://localhost:8080
- Test creates its own isolated data

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP15 Tulip","sku":"EP15-TULIP","barcode":"BC-EP15","price":3.00,"isActive":true}`. Store `data.id` as `$PLANT_ID`.
2. Set inventory with `plantCatalogId: $PLANT_ID` and `onHandQty: 10`.
3. Create a customer via `POST /api/customers` with `{"displayName":"EP15 Customer"}`. Store `data.id` as `$CUSTOMER_ID`.
4. Create a non-walk-up (preorder) order via `POST /api/orders` with body:
   ```json
   {
     "customerId": "$CUSTOMER_ID",
     "isWalkUp": false,
     "lines": [{"plantCatalogId": "$PLANT_ID", "qtyOrdered": 3}]
   }
   ```
5. Assert the order is created with `success: true`.
6. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`.
7. Assert response HTTP 200 with `success: true`.
8. Assert `data.onHandQty` equals `10`.
9. Assert `data.preorderRemaining` equals `3`.
10. Assert `data.availableForWalkup` equals `7`.

## Expected Results
- Response: `{ success: true, data: { onHandQty: 10, preorderRemaining: 3, availableForWalkup: 7 } }`
- The formula `AvailableForWalkup = OnHandQty - PreorderRemaining` is correctly applied

## Execution Tool
bash -- `cd api && dotnet test --filter "EP15_GetWalkUpAvailability"`

## Pass / Fail Criteria
- **Pass:** Availability returns `availableForWalkup: 7` with `onHandQty: 10` and `preorderRemaining: 3`.
- **Fail:** Availability calculation is incorrect, or preorder quantities are not deducted from on-hand.
