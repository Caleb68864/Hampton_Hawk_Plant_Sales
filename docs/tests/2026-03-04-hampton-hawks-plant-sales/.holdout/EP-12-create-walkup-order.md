---
scenario_id: "EP-12"
title: "Create walk-up order with new customer"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - walkup
---

# Scenario EP-12: Create walk-up order with new customer

## Description
Verifies that `POST /api/walkup/orders` creates a walk-up order with `IsWalkUp=true`. When a `DisplayName` and `Phone` are provided without an existing `CustomerId`, the system auto-creates a new customer and links it to the order.

## Preconditions
- API is running at http://localhost:8080
- No existing customer with the test phone number

## Steps

1. Call `POST /api/walkup/orders` with body:
   ```json
   {
     "displayName": "Jane Walk-Up",
     "phone": "555-9999",
     "notes": "EP-12 test order"
   }
   ```
2. Assert response HTTP 200 with `success: true`.
3. Assert `data.isWalkUp` is `true`.
4. Assert `data.id` is a valid non-empty GUID.
5. Assert `data.customerId` is a valid non-empty GUID (customer was auto-created).
6. Assert `data.orderNumber` is a non-empty string.
7. Call `GET /api/customers/{customerId}` using the returned `customerId`.
8. Assert the customer record exists with `displayName` matching "Jane Walk-Up" and `phone` matching "555-9999".
9. Call `POST /api/walkup/orders` again with the same `displayName` and `phone`.
10. Assert the second order reuses the same `customerId` (customer is found, not duplicated).

## Expected Results
- `POST /api/walkup/orders` returns HTTP 200 with `success: true`
- `data.isWalkUp` is `true`
- `data.customerId` is populated (auto-created customer)
- The auto-created customer has the correct `displayName` and `phone`
- A second call with the same name+phone reuses the existing customer

## Execution Tool
bash -- `cd api && dotnet test --filter "EP12_CreateWalkUpOrder"`

## Pass / Fail Criteria
- **Pass:** Walk-up order is created with `isWalkUp: true`, customer is auto-created with correct name and phone, and a repeat call reuses the same customer.
- **Fail:** Order is not marked as walk-up, customer is not created, customer fields are wrong, or a duplicate customer is created on the second call.
