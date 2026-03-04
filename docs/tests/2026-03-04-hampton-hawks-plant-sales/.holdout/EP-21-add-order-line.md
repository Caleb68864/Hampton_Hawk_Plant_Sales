---
scenario_id: "EP-21"
title: "Add a line to an existing order"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-21: Add a line to an existing order

## Description
Verifies that `POST /api/orders/{id}/lines` adds a new line item to an existing order with the correct `plantCatalogId` and `qtyOrdered`, and that the line appears when the order is re-fetched.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order

## Steps

1. Create two plants:
   - Plant A: `{"name":"EP21 Mint","sku":"EP21-MINT","barcode":"BC-EP21A","price":3.00,"isActive":true}`. Store `$PLANT_A_ID`.
   - Plant B: `{"name":"EP21 Sage","sku":"EP21-SAGE","barcode":"BC-EP21B","price":3.50,"isActive":true}`. Store `$PLANT_B_ID`.
2. Create a customer. Store `$CUSTOMER_ID`.
3. Create an order via `POST /api/orders` with one line for Plant A (`qtyOrdered: 2`). Store `data.id` as `$ORDER_ID`.
4. Verify `data.lines` has exactly 1 entry.
5. Call `POST /api/orders/$ORDER_ID/lines` with body:
   ```json
   {
     "plantCatalogId": "$PLANT_B_ID",
     "qtyOrdered": 5,
     "notes": "EP-21 added line"
   }
   ```
6. Assert response HTTP 200 with `success: true`.
7. Assert `data.plantCatalogId` equals `$PLANT_B_ID`.
8. Assert `data.qtyOrdered` equals `5`.
9. Assert `data.qtyFulfilled` equals `0`.
10. Assert `data.notes` equals `"EP-21 added line"`.
11. Store `data.id` as `$LINE_ID`.
12. Call `GET /api/orders/$ORDER_ID`.
13. Assert `data.lines` has exactly 2 entries.
14. Assert one line has `plantCatalogId` equal to `$PLANT_A_ID` and another has `plantCatalogId` equal to `$PLANT_B_ID`.

## Expected Results
- New line is created with correct plant, quantity, and notes
- `qtyFulfilled` defaults to 0
- The order detail now shows 2 lines

## Execution Tool
bash -- `cd api && dotnet test --filter "EP21_AddOrderLine"`

## Pass / Fail Criteria
- **Pass:** Line is added with correct fields, and the order detail shows both lines.
- **Fail:** Line creation fails, fields are incorrect, or the order detail does not reflect the new line.
