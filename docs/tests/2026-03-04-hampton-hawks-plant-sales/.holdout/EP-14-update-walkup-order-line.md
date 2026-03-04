---
scenario_id: "EP-14"
title: "Update walk-up order line quantity"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - walkup
---

# Scenario EP-14: Update walk-up order line quantity

## Description
Verifies that updating the quantity on a walk-up order line via `PUT /api/walkup/orders/{id}/lines/{lineId}` persists the change and causes the walk-up availability to be recalculated correctly.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order (state depends on prior steps)

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP14 Daisy","sku":"EP14-DAISY","barcode":"BC-EP14","price":4.25,"isActive":true}`. Store `data.id` as `$PLANT_ID`.
2. Set inventory with `plantCatalogId: $PLANT_ID` and `onHandQty: 15`.
3. Create a walk-up order via `POST /api/walkup/orders` with `{"displayName":"EP14 Buyer","phone":"555-1400"}`. Store `data.id` as `$ORDER_ID`.
4. Add a line via `POST /api/walkup/orders/$ORDER_ID/lines` with `{"plantCatalogId":"$PLANT_ID","qtyOrdered":2}`. Store `data.id` as `$LINE_ID`.
5. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`. Assert `data.availableForWalkup` equals `13` (15 - 2).
6. Update the line via `PUT /api/walkup/orders/$ORDER_ID/lines/$LINE_ID` with body:
   ```json
   {
     "plantCatalogId": "$PLANT_ID",
     "qtyOrdered": 5
   }
   ```
7. Assert response HTTP 200 with `success: true`.
8. Assert `data.qtyOrdered` equals `5`.
9. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`. Assert `data.availableForWalkup` equals `10` (15 - 5).
10. Update the line again via `PUT /api/walkup/orders/$ORDER_ID/lines/$LINE_ID` with `{"plantCatalogId":"$PLANT_ID","qtyOrdered":1}`.
11. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`. Assert `data.availableForWalkup` equals `14` (15 - 1).

## Expected Results
- Line quantity is updated from 2 to 5, then from 5 to 1
- Walk-up availability recalculates after each update: 13 -> 10 -> 14

## Execution Tool
bash -- `cd api && dotnet test --filter "EP14_UpdateWalkUpOrderLine"`

## Pass / Fail Criteria
- **Pass:** Line quantity updates are persisted and walk-up availability recalculates correctly after each change.
- **Fail:** Quantity update fails, or availability does not reflect the new quantity.
