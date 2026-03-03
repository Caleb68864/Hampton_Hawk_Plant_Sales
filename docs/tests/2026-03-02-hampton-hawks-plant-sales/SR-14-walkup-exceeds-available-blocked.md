---
scenario_id: "SR-14"
title: "Walk-up order line blocked when quantity exceeds available inventory"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-14: Walk-up order line blocked when quantity exceeds available inventory

## Description
Verifies that the system correctly computes AvailableForWalkup as (inventory - preorder qty) and rejects a walk-up line request that would exceed that remaining quantity.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a plant via POST /api/plants with `inventory: 10`.
2. Create a customer for a preorder via POST /api/customers.
3. Create a preorder for that customer via POST /api/orders (type: preorder or default order type).
4. Add an order line to the preorder via POST /api/orders/{id}/lines with `qtyOrdered: 8` for the plant created in step 1.
5. Verify AvailableForWalkup for that plant is 2 via GET /api/plants/{id} (check the `availableForWalkup` field in the response).
6. Create a second customer for a walk-up order via POST /api/customers.
7. Create a walk-up order for the second customer via POST /api/orders (type: walkup).
8. Attempt to POST /api/orders/{walkupId}/lines with `qtyOrdered: 5` for the same plant.
9. Assert the HTTP response status is 400.
10. Verify the walk-up order has no lines (or the line was not added) via GET /api/orders/{walkupId}.

## Expected Results
- Step 5 shows `availableForWalkup: 2` (or equivalent field showing 2 remaining).
- Step 8 returns HTTP 400.
- Response envelope includes `{ success: false, errors: [...] }` with a message indicating insufficient inventory or exceeds available.
- Step 10 confirms no line was added to the walk-up order for that plant.

## Execution Tool
bash -- use curl; parse JSON responses with jq to assert field values.

## Pass / Fail Criteria
- **Pass:** AvailableForWalkup is 2, the walk-up line request for qty=5 returns 400, and no line is added.
- **Fail:** The request is accepted (non-400 response), or AvailableForWalkup is calculated incorrectly.
