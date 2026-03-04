---
scenario_id: "EP-23"
title: "Delete an order line (soft delete)"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-23: Delete an order line (soft delete)

## Description
Verifies that `DELETE /api/orders/{id}/lines/{lineId}` soft-deletes the line item so it no longer appears in the order's lines when the order is re-fetched.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP23 Ivy","sku":"EP23-IVY","barcode":"BC-EP23","price":4.00,"isActive":true}`. Store `$PLANT_ID`.
2. Create a customer. Store `$CUSTOMER_ID`.
3. Create an order via `POST /api/orders` with two lines:
   ```json
   {
     "customerId": "$CUSTOMER_ID",
     "isWalkUp": false,
     "lines": [
       {"plantCatalogId": "$PLANT_ID", "qtyOrdered": 2},
       {"plantCatalogId": "$PLANT_ID", "qtyOrdered": 1}
     ]
   }
   ```
   Store `data.id` as `$ORDER_ID`.
4. Get the order via `GET /api/orders/$ORDER_ID`. Assert `data.lines` has 2 entries. Store the first line's `id` as `$LINE_ID`.
5. Call `DELETE /api/orders/$ORDER_ID/lines/$LINE_ID`.
6. Assert response HTTP 200 with `success: true` and `data: true`.
7. Call `GET /api/orders/$ORDER_ID`.
8. Assert `data.lines` has exactly 1 entry.
9. Assert the remaining line's `id` is NOT equal to `$LINE_ID`.
10. Call `DELETE /api/orders/$ORDER_ID/lines/{random-guid}` with a non-existent line ID.
11. Assert response HTTP 404 with `success: false`.

## Expected Results
- `DELETE /api/orders/{id}/lines/{lineId}` returns `{ success: true, data: true }`
- The deleted line no longer appears in the order's lines
- The other line remains intact
- Deleting a non-existent line returns 404

## Execution Tool
bash -- `cd api && dotnet test --filter "EP23_DeleteOrderLine"`

## Pass / Fail Criteria
- **Pass:** Line is soft-deleted, no longer appears in the order, the other line remains, and a non-existent line returns 404.
- **Fail:** Line is not removed from the order detail, both lines disappear, or the non-existent line does not return 404.
