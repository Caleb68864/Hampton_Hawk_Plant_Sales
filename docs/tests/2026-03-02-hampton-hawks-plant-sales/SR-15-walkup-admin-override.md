---
scenario_id: "SR-15"
title: "Walk-up admin override allows exceeding available inventory and sets HasIssue"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-15: Walk-up admin override allows exceeding available inventory and sets HasIssue

## Description
Verifies that an admin can override the walk-up inventory restriction by providing the admin PIN headers, and that the resulting order is flagged with HasIssue=true to indicate the override occurred.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Same inventory setup as SR-14: plant with inventory=10, preorder with qtyOrdered=8, leaving AvailableForWalkup=2
- Steps must be executed in order (sequential: true)

## Steps
1. Create a plant via POST /api/plants with `inventory: 10`.
2. Create a customer and preorder with `qtyOrdered: 8` for that plant (same setup as SR-14).
3. Confirm AvailableForWalkup = 2 via GET /api/plants/{id}.
4. Create a second customer for a walk-up order via POST /api/customers.
5. Create a walk-up order for the second customer via POST /api/orders.
6. POST /api/orders/{walkupId}/lines with `qtyOrdered: 5` AND headers `X-Admin-Pin: 1234` and `X-Admin-Reason: "Admin override test"`.
7. Assert the HTTP response status is 200 or 201.
8. GET /api/orders/{walkupId} and verify `hasIssue: true` on the order.
9. Verify the line with qty=5 exists in the order's lines array.

## Expected Results
- Step 6 returns HTTP 200 or 201 with `{ success: true, data: { ... } }`.
- Step 8 shows `hasIssue: true` (or equivalent flag) on the order.
- Step 9 confirms the line was added with `qtyOrdered: 5`.

## Execution Tool
bash -- use curl with `-H "X-Admin-Pin: 1234" -H "X-Admin-Reason: Admin override test"` on the line creation request; parse responses with jq.

## Pass / Fail Criteria
- **Pass:** The line is created successfully (2xx), the order shows HasIssue=true, and the line qty=5 is present.
- **Fail:** Request is rejected (non-2xx), or HasIssue remains false/absent after the override.
