---
scenario_id: "EP-08"
title: "Complete order"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
---

# Scenario EP-08: Complete order

## Description
Verifies that after all OrderLines are fully fulfilled (QtyFulfilled == QtyOrdered for every line), calling the complete endpoint transitions the Order.Status to Complete.

## Preconditions
- An Order exists with status InProgress
- All OrderLines have QtyFulfilled == QtyOrdered (fully fulfilled)

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=2, QtyFulfilled=0)
2. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }` -- QtyFulfilled becomes 1
3. Call `POST /api/orders/{orderId}/scan` with body `{ "barcode": "TEST-001" }` -- QtyFulfilled becomes 2 (fully fulfilled)
4. Verify OrderLine.QtyFulfilled=2 and Inventory.OnHandQty=8
5. Call `POST /api/orders/{orderId}/complete`
6. Assert response status 200 with `success: true`
7. Verify Order.Status changed to Complete
8. Verify Inventory.OnHandQty=8 (unchanged by complete operation)

## Expected Results
- Response: `{ success: true, data: { ... } }`
- Order.Status = Complete
- All OrderLines have QtyFulfilled == QtyOrdered
- Inventory.OnHandQty = 8 (unchanged by the complete call itself)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP08_CompleteOrder"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, order status is Complete, all lines fully fulfilled
- **Fail:** Any assertion fails, or order marked Complete with unfulfilled lines, or inventory incorrectly modified
