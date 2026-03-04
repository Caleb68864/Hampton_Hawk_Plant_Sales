---
scenario_id: "EP-22"
title: "Update an order line"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-22: Update an order line

## Description
Verifies that `PUT /api/orders/{id}/lines/{lineId}` updates the quantity and notes on an existing order line, and that the changes are persisted when the order is re-fetched.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP22 Petunia","sku":"EP22-PET","barcode":"BC-EP22","price":2.50,"isActive":true}`. Store `$PLANT_ID`.
2. Create a customer. Store `$CUSTOMER_ID`.
3. Create an order via `POST /api/orders` with one line for `$PLANT_ID` (`qtyOrdered: 3`). Store `data.id` as `$ORDER_ID`.
4. Get the order via `GET /api/orders/$ORDER_ID`. Store the first line's `id` as `$LINE_ID`.
5. Assert the line has `qtyOrdered: 3` and `notes` is null or empty.
6. Call `PUT /api/orders/$ORDER_ID/lines/$LINE_ID` with body:
   ```json
   {
     "qtyOrdered": 7,
     "notes": "Updated by EP-22"
   }
   ```
7. Assert response HTTP 200 with `success: true`.
8. Assert `data.qtyOrdered` equals `7`.
9. Assert `data.notes` equals `"Updated by EP-22"`.
10. Call `GET /api/orders/$ORDER_ID` to re-fetch.
11. Find the line with `id` equal to `$LINE_ID`.
12. Assert `qtyOrdered` equals `7`.
13. Assert `notes` equals `"Updated by EP-22"`.
14. Assert `plantCatalogId` is unchanged (still `$PLANT_ID`).

## Expected Results
- Line quantity updated from 3 to 7
- Notes updated to "Updated by EP-22"
- `plantCatalogId` remains unchanged
- Changes are persisted on re-fetch

## Execution Tool
bash -- `cd api && dotnet test --filter "EP22_UpdateOrderLine"`

## Pass / Fail Criteria
- **Pass:** Quantity and notes are updated on both the PUT response and subsequent GET, and the plant reference is unchanged.
- **Fail:** Quantity or notes are not updated, or the plant reference changes unexpectedly.
