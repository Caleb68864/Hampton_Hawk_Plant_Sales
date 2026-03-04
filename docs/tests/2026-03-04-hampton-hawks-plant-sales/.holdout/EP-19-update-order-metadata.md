---
scenario_id: "EP-19"
title: "Update order metadata"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - orders
---

# Scenario EP-19: Update order metadata

## Description
Verifies that `PUT /api/orders/{id}` updates the order's metadata fields (`status`, `customerId`, `sellerId`, `isWalkUp`, `hasIssue`) and that the changes are persisted when the order is re-fetched.

## Preconditions
- API is running at http://localhost:8080
- Steps must run in order

## Steps

1. Create a customer (Customer A) and a seller. Store their IDs.
2. Create a second customer (Customer B). Store `$CUSTOMER_B_ID`.
3. Create an order via `POST /api/orders` with `customerId` set to Customer A, `sellerId` set to the seller, `isWalkUp: false`, and one line item. Store `data.id` as `$ORDER_ID`.
4. Assert the initial order has `status: "Open"` and `customerId` equal to Customer A.
5. Call `PUT /api/orders/$ORDER_ID` with body:
   ```json
   {
     "customerId": "$CUSTOMER_B_ID",
     "sellerId": "$SELLER_ID",
     "status": "InProgress",
     "isWalkUp": false,
     "hasIssue": true
   }
   ```
6. Assert response HTTP 200 with `success: true`.
7. Assert `data.customerId` equals `$CUSTOMER_B_ID`.
8. Assert `data.status` equals `"InProgress"` (or `1`).
9. Assert `data.hasIssue` equals `true`.
10. Call `GET /api/orders/$ORDER_ID` to re-fetch.
11. Assert `data.customerId` equals `$CUSTOMER_B_ID`.
12. Assert `data.status` equals `"InProgress"`.
13. Assert `data.hasIssue` equals `true`.

## Expected Results
- `PUT /api/orders/{id}` returns the updated order with new values
- Re-fetching the order confirms the changes are persisted
- `customerId` is changed from Customer A to Customer B
- `status` is changed from Open to InProgress
- `hasIssue` is set to true

## Execution Tool
bash -- `cd api && dotnet test --filter "EP19_UpdateOrderMetadata"`

## Pass / Fail Criteria
- **Pass:** All updated fields are correctly persisted and returned on both the PUT response and subsequent GET.
- **Fail:** Any field reverts to its old value, or the PUT/GET responses disagree.
