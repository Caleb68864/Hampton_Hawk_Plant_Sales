---
scenario_id: "SR-17"
title: "Admin can force-complete an order even when sale is closed"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-17: Admin can force-complete an order even when sale is closed

## Description
Verifies that an admin using the correct PIN can force-complete an order with unfulfilled lines even after the sale has been closed, bypassing the normal sale-closed restriction.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a customer via POST /api/customers.
2. Create an order with at least one unfulfilled line via POST /api/orders and POST /api/orders/{id}/lines.
3. Confirm the order has unfulfilled lines via GET /api/orders/{id}.
4. Close the sale via PUT /api/settings/sale-closed with headers `X-Admin-Pin: 1234` and `X-Admin-Reason: "Close for test"` and body `{ "isClosed": true }` (or equivalent payload).
5. Confirm the sale is closed via GET /api/settings (or equivalent).
6. POST /api/orders/{id}/force-complete with headers `X-Admin-Pin: 1234` and `X-Admin-Reason: "Force complete test"`.
7. Assert the HTTP response status is 200 and `success: true`.
8. GET /api/orders/{id} and verify the order status is Completed (or equivalent completed state).
9. Reopen the sale via PUT /api/settings/sale-closed with admin PIN and `{ "isClosed": false }`.

## Expected Results
- Step 4 succeeds (200) and the sale is confirmed closed in step 5.
- Step 6 returns HTTP 200 with `{ success: true, data: { ... } }`.
- Step 8 shows the order in a completed/force-completed status despite the sale being closed.

## Execution Tool
bash -- use curl with admin PIN headers for sale-close and force-complete calls; parse responses with jq.

## Pass / Fail Criteria
- **Pass:** Force-complete with admin PIN returns 200 and the order is marked completed while the sale is closed.
- **Fail:** Force-complete is rejected (non-200) even with admin PIN when the sale is closed.
