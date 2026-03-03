---
scenario_id: "SR-11"
title: "Force-complete order without admin PIN returns 403"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-11: Force-complete order without admin PIN returns 403

## Description
Verifies that the force-complete endpoint is protected and returns 403 when called without the required admin PIN headers. The order must remain unchanged after the failed attempt.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- At least one customer exists or can be created

## Steps
1. Create a customer via POST /api/customers with a valid name and email.
2. Create an order for that customer via POST /api/orders.
3. Add at least one order line via POST /api/orders/{id}/lines so the order has unfulfilled lines.
4. Note the order ID and current status from the response.
5. POST /api/orders/{id}/force-complete with NO headers (no X-Admin-Pin, no X-Admin-Reason).
6. Assert the HTTP response status is 403.
7. GET /api/orders/{id} and verify the order status is unchanged (still InProgress or the original status).

## Expected Results
- Step 5 returns HTTP 403.
- Response envelope: `{ success: false, errors: [...] }`.
- Step 7 confirms the order status has not changed from its pre-request value.
- No fulfillment or completion state has been applied to the order.

## Execution Tool
bash -- use curl for all HTTP calls; assert status codes with `-o /dev/null -w "%{http_code}"`.

## Pass / Fail Criteria
- **Pass:** POST /api/orders/{id}/force-complete without headers returns exactly 403, and a subsequent GET confirms the order is unmodified.
- **Fail:** Any other status code is returned, or the order status changes despite the missing headers.
