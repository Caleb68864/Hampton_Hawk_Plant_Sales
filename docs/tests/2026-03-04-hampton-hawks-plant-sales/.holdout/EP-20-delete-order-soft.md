---
scenario_id: "EP-20"
title: "Soft-delete an order"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-20: Soft-delete an order

## Description
Verifies that `DELETE /api/orders/{id}` performs a soft delete by setting `DeletedAt` on the order. The order must be excluded from default `GET /api/orders` queries but visible when `includeDeleted=true` is passed.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order

## Steps

1. Create a customer and a plant with inventory (setup).
2. Create an order via `POST /api/orders` with one line item. Store `data.id` as `$ORDER_ID` and `data.orderNumber` as `$ORDER_NUMBER`.
3. Verify the order appears in `GET /api/orders` (default listing).
4. Call `DELETE /api/orders/$ORDER_ID`.
5. Assert response HTTP 200 with `success: true` and `data: true`.
6. Call `GET /api/orders`. Assert the deleted order does NOT appear in the results (search by `$ORDER_NUMBER` or iterate items).
7. Call `GET /api/orders?includeDeleted=true`. Assert the deleted order DOES appear in the results.
8. Call `GET /api/orders/$ORDER_ID`. Assert response HTTP 404 with `success: false` (soft-deleted orders excluded from GetById default).
9. Call `DELETE /api/orders/{random-guid}` with a non-existent ID. Assert response HTTP 404 with `success: false`.

## Expected Results
- `DELETE /api/orders/{id}` returns `{ success: true, data: true }`
- The order is excluded from default listings
- The order is included when `includeDeleted=true`
- Direct `GET /api/orders/{id}` returns 404 for a soft-deleted order
- Deleting a non-existent order returns 404

## Execution Tool
bash -- `cd api && dotnet test --filter "EP20_DeleteOrderSoft"`

## Pass / Fail Criteria
- **Pass:** Order is soft-deleted, excluded from default queries, included with `includeDeleted=true`, and direct GET returns 404.
- **Fail:** Order is hard-deleted, still appears in default listings after deletion, or does not appear with `includeDeleted=true`.
