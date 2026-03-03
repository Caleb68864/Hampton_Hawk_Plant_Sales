---
scenario_id: "SR-12"
title: "Reset completed order with admin PIN restores InProgress status"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-12: Reset completed order with admin PIN restores InProgress status

## Description
Verifies that an admin can reset a completed order back to InProgress using the correct PIN, and that the action is recorded as an AdminAction in the audit log.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a customer via POST /api/customers.
2. Create an order for that customer via POST /api/orders.
3. Add order lines via POST /api/orders/{id}/lines for at least one plant.
4. Fulfill all lines by scanning or patching each line to a fulfilled state.
5. Complete the order via POST /api/orders/{id}/complete (or force-complete if needed with admin PIN).
6. Confirm the order status is Completed via GET /api/orders/{id}.
7. POST /api/orders/{id}/reset with headers `X-Admin-Pin: 1234` and `X-Admin-Reason: "Test reset"`.
8. Assert the response status is 200 and `success: true`.
9. GET /api/orders/{id} and verify the order status is now InProgress.
10. GET /api/orders/{id}/audit (or the relevant audit endpoint) and verify an AdminAction entry exists for the reset.

## Expected Results
- Step 7 returns HTTP 200 with `{ success: true, data: { ... } }`.
- Step 9 shows `status: "InProgress"` (or equivalent reset state).
- Step 10 shows an audit log entry with action type AdminAction referencing the reset operation and the provided reason.

## Execution Tool
bash -- use curl with `-H "X-Admin-Pin: 1234" -H "X-Admin-Reason: Test reset"` for the reset call.

## Pass / Fail Criteria
- **Pass:** Reset endpoint returns 200, order status reverts to InProgress, and an AdminAction audit entry is present.
- **Fail:** Non-200 response, order status does not change, or no AdminAction is logged.
