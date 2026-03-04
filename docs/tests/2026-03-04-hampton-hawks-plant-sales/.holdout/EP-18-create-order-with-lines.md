---
scenario_id: "EP-18"
title: "Create order with customer, seller, and line items"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-18: Create order with customer, seller, and line items

## Description
Verifies that `POST /api/orders` creates an order with a `customerId`, `sellerId`, and one or more line items. The response should include the auto-generated `orderNumber`, the linked customer and seller, and the created lines.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order (setup then create)

## Steps

1. Create a plant via `POST /api/plants` with `{"name":"EP18 Basil","sku":"EP18-BASIL","barcode":"BC-EP18","price":2.99,"isActive":true}`. Store `data.id` as `$PLANT_ID`.
2. Create a customer via `POST /api/customers` with `{"displayName":"EP18 Customer","firstName":"Ellie","lastName":"Plant","phone":"555-1800"}`. Store `data.id` as `$CUSTOMER_ID`.
3. Create a seller via `POST /api/sellers` with `{"displayName":"EP18 Seller","firstName":"Sam","lastName":"Sell","grade":"5","teacher":"Ms. Bloom"}`. Store `data.id` as `$SELLER_ID`.
4. Call `POST /api/orders` with body:
   ```json
   {
     "customerId": "$CUSTOMER_ID",
     "sellerId": "$SELLER_ID",
     "isWalkUp": false,
     "lines": [
       {"plantCatalogId": "$PLANT_ID", "qtyOrdered": 4}
     ]
   }
   ```
5. Assert response HTTP 200 with `success: true`.
6. Assert `data.id` is a valid non-empty GUID.
7. Assert `data.orderNumber` is a non-empty string.
8. Assert `data.customerId` equals `$CUSTOMER_ID`.
9. Assert `data.sellerId` equals `$SELLER_ID`.
10. Assert `data.isWalkUp` is `false`.
11. Assert `data.status` equals `"Open"` (or `0`).
12. Assert `data.lines` has exactly 1 entry.
13. Assert the line has `plantCatalogId` equal to `$PLANT_ID`, `qtyOrdered` equal to `4`, and `qtyFulfilled` equal to `0`.

## Expected Results
- Order is created with correct `customerId`, `sellerId`, and `isWalkUp=false`
- Auto-generated `orderNumber` is present
- Status defaults to `Open`
- Lines array contains the created line with correct plant and quantity

## Execution Tool
bash -- `cd api && dotnet test --filter "EP18_CreateOrderWithLines"`

## Pass / Fail Criteria
- **Pass:** Order is created with all fields correct, orderNumber is auto-generated, and lines are included.
- **Fail:** Any field is missing or incorrect, orderNumber is empty, or lines are not returned.
