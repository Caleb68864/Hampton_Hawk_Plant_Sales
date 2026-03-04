---
scenario_id: "EP-09"
title: "Force complete order with admin PIN"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
  - admin-pin
---

# Scenario EP-09: Force complete order with admin PIN

## Description
Verifies that an admin can force-complete an order that has unfulfilled lines by providing X-Admin-Pin and X-Admin-Reason headers. The order transitions to Complete and an AdminAction is logged.

## Preconditions
- An Order exists with status InProgress
- At least one OrderLine has QtyFulfilled < QtyOrdered (not fully fulfilled)
- A valid admin PIN is configured in the system

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=10, Customer, Order with one OrderLine (QtyOrdered=3, QtyFulfilled=1), Order.Status=InProgress
2. Call `POST /api/orders/{orderId}/force-complete` with headers `X-Admin-Pin: {validPin}` and `X-Admin-Reason: "Customer confirmed partial pickup - remaining items cancelled"`
3. Assert response status 200 with `success: true`
4. Verify Order.Status changed to Complete
5. Verify OrderLine.QtyFulfilled remains 1 (unchanged -- not auto-fulfilled)
6. Verify an AdminAction was logged with the reason "Customer confirmed partial pickup - remaining items cancelled"
7. Verify Inventory.OnHandQty remains 10 (no additional inventory changes)

## Expected Results
- Response: `{ success: true, data: { ... } }`
- Order.Status = Complete
- OrderLine.QtyFulfilled = 1 (unchanged)
- AdminAction logged with reason "Customer confirmed partial pickup - remaining items cancelled"
- Inventory.OnHandQty = 10 (unchanged)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP09_ForceComplete_AdminPin"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, order force-completed, AdminAction logged with correct reason
- **Fail:** Any assertion fails, or AdminAction not logged, or endpoint accessible without admin PIN
