---
scenario_id: "EP-13"
title: "Add line to walk-up order"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - walkup
---

# Scenario EP-13: Add line to walk-up order

## Description
Verifies that adding a line item to a walk-up order via `POST /api/walkup/orders/{id}/lines` succeeds, decreases walk-up availability for the plant, and updates the order total.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order (state depends on prior steps)

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP13 Fern","sku":"EP13-FERN","barcode":"BC-EP13","price":5.50,"isActive":true}`. Store `data.id` as `$PLANT_ID`.
2. Set inventory via the inventory endpoint with `plantCatalogId: $PLANT_ID` and `onHandQty: 20`.
3. Call `GET /api/walkup/availability` and find the entry for `$PLANT_ID`. Record `availableForWalkup` as `$AVAIL_BEFORE`.
4. Create a walk-up order via `POST /api/walkup/orders` with `{"displayName":"EP13 Buyer","phone":"555-1300"}`. Store `data.id` as `$ORDER_ID`.
5. Add a line via `POST /api/walkup/orders/$ORDER_ID/lines` with body:
   ```json
   {
     "plantCatalogId": "$PLANT_ID",
     "qtyOrdered": 3
   }
   ```
6. Assert response HTTP 200 with `success: true`.
7. Assert `data.plantCatalogId` equals `$PLANT_ID`.
8. Assert `data.qtyOrdered` equals `3`.
9. Call `GET /api/walkup/availability?plantCatalogId=$PLANT_ID`.
10. Assert `data.availableForWalkup` equals `$AVAIL_BEFORE - 3`.
11. Call `GET /api/orders/$ORDER_ID` and verify `data.lines` contains one entry with `qtyOrdered: 3`.

## Expected Results
- Line is created with the correct `plantCatalogId` and `qtyOrdered`
- Walk-up availability for the plant decreases by the ordered quantity
- The order detail shows the new line

## Execution Tool
bash -- `cd api && dotnet test --filter "EP13_AddLineWalkUpOrder"`

## Pass / Fail Criteria
- **Pass:** Line is added successfully, availability decreases by 3, and the order detail includes the line.
- **Fail:** Line creation fails, availability does not decrease, or the order detail does not include the line.
