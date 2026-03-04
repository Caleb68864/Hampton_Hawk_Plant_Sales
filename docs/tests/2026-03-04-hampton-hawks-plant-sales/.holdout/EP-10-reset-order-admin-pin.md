---
scenario_id: "EP-10"
title: "Reset order with admin PIN"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - fulfillment
  - admin-pin
---

# Scenario EP-10: Reset order with admin PIN

## Description
Verifies that an admin can reset a completed order back to InProgress by providing X-Admin-Pin and X-Admin-Reason headers. The order status reverts and an AdminAction is logged.

## Preconditions
- An Order exists with status Complete
- A valid admin PIN is configured in the system

## Steps

1. Create test data: Plant with barcode "TEST-001", Inventory with OnHandQty=8, Customer, Order with one OrderLine (QtyOrdered=2, QtyFulfilled=2), Order.Status=Complete
2. Call `POST /api/orders/{orderId}/reset` with headers `X-Admin-Pin: {validPin}` and `X-Admin-Reason: "Customer returned to pick up additional items - reopening order"`
3. Assert response status 200 with `success: true`
4. Verify Order.Status changed to InProgress
5. Verify OrderLine.QtyFulfilled remains 2 (unchanged -- fulfillment history preserved)
6. Verify an AdminAction was logged with the reason "Customer returned to pick up additional items - reopening order"
7. Verify Inventory.OnHandQty remains 8 (no inventory changes on reset)

## Expected Results
- Response: `{ success: true, data: { ... } }`
- Order.Status = InProgress
- OrderLine.QtyFulfilled = 2 (unchanged)
- AdminAction logged with reason "Customer returned to pick up additional items - reopening order"
- Inventory.OnHandQty = 8 (unchanged)

## Execution Tool
bash -- `cd api && dotnet test --filter "EP10_ResetOrder_AdminPin"`

## Pass / Fail Criteria
- **Pass:** All assertions pass, order reset to InProgress, AdminAction logged with correct reason
- **Fail:** Any assertion fails, or AdminAction not logged, or endpoint accessible without admin PIN
