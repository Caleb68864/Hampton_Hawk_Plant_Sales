---
scenario_id: "EP-17"
title: "Get order by ID with lines and plant details"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - orders
---

# Scenario EP-17: Get order by ID with lines and plant details

## Description
Verifies that `GET /api/orders/{id}` returns the full order response including `OrderLines` with `PlantCatalog` details (`plantName`, `plantSku`) populated on each line.

## Preconditions
- API is running at http://localhost:8080
- Test creates its own seed data

## Steps

1. Create two plants:
   - Plant A: `{"name":"EP17 Rose","sku":"EP17-ROSE","barcode":"BC-EP17A","price":6.00,"isActive":true}`. Store `$PLANT_A_ID`.
   - Plant B: `{"name":"EP17 Lily","sku":"EP17-LILY","barcode":"BC-EP17B","price":4.50,"isActive":true}`. Store `$PLANT_B_ID`.
2. Create a customer. Store `$CUSTOMER_ID`.
3. Create an order via `POST /api/orders` with body:
   ```json
   {
     "customerId": "$CUSTOMER_ID",
     "isWalkUp": false,
     "lines": [
       {"plantCatalogId": "$PLANT_A_ID", "qtyOrdered": 3},
       {"plantCatalogId": "$PLANT_B_ID", "qtyOrdered": 1}
     ]
   }
   ```
   Store `data.id` as `$ORDER_ID`.
4. Call `GET /api/orders/$ORDER_ID`.
5. Assert response HTTP 200 with `success: true`.
6. Assert `data.id` equals `$ORDER_ID`.
7. Assert `data.customerId` equals `$CUSTOMER_ID`.
8. Assert `data.orderNumber` is a non-empty string.
9. Assert `data.lines` has exactly 2 entries.
10. For the line with `plantCatalogId` equal to `$PLANT_A_ID`:
    - Assert `plantName` equals `"EP17 Rose"`.
    - Assert `plantSku` equals `"EP17-ROSE"`.
    - Assert `qtyOrdered` equals `3`.
    - Assert `qtyFulfilled` equals `0`.
11. For the line with `plantCatalogId` equal to `$PLANT_B_ID`:
    - Assert `plantName` equals `"EP17 Lily"`.
    - Assert `plantSku` equals `"EP17-LILY"`.
    - Assert `qtyOrdered` equals `1`.
12. Call `GET /api/orders/{random-guid}` with a non-existent ID.
13. Assert response HTTP 404 with `success: false`.

## Expected Results
- Order detail includes all lines with populated `plantName` and `plantSku`
- Each line has correct `qtyOrdered` and `qtyFulfilled` values
- Non-existent order ID returns 404

## Execution Tool
bash -- `cd api && dotnet test --filter "EP17_GetOrderById"`

## Pass / Fail Criteria
- **Pass:** Order response includes all lines with correct plant details, quantities, and a 404 is returned for a non-existent order.
- **Fail:** Lines are missing, plant details are empty or incorrect, or a non-existent order does not return 404.
