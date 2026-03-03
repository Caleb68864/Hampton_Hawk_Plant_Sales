---
scenario_id: "DB-01"
title: "Concurrent scan requests do not over-decrement inventory"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario DB-01: Concurrent scan requests do not over-decrement inventory

## Description
Verifies that the database handles concurrent scan requests safely, ensuring inventory cannot go below zero and that simultaneous scans of the same plant produce correct, consistent results without race conditions.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)
- `curl` and basic shell job control available in the test environment

## Steps
1. Create a plant via POST /api/plants with `inventory: 2`.
2. Create a customer and an order with 2 lines (both for the same plant) via POST /api/customers, POST /api/orders, and POST /api/orders/{id}/lines (qty=1 each, or one line with qty=2 -- confirm what's valid).
3. Note the plant ID and order ID.
4. Launch two simultaneous scan requests using curl run in parallel (background processes):
   ```bash
   curl -s -X POST http://localhost:8080/api/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode": "<plant_barcode>", "orderId": <orderId>}' &
   curl -s -X POST http://localhost:8080/api/scan \
     -H "Content-Type: application/json" \
     -d '{"barcode": "<plant_barcode>", "orderId": <orderId>}' &
   wait
   ```
5. After both requests complete, GET /api/plants/{id} and verify the inventory value.
6. Verify inventory equals 0 (both scans consumed the 2 available units) and NOT -1 or negative.
7. Review both scan response payloads to confirm each returned a correct result (no silent failure or duplicate decrement).

## Expected Results
- Both scan requests complete without 500 errors.
- GET /api/plants/{id} shows `inventory: 0` (not -1 or any negative value).
- The combined scan results account for exactly 2 units consumed.
- No database constraint violation or concurrency error is surfaced.

## Execution Tool
bash -- launch two curl processes in parallel using shell background jobs (`&`) and `wait`; compare final inventory via jq.

## Pass / Fail Criteria
- **Pass:** Final inventory is exactly 0, no negative value, and both scan responses are valid (no 500s).
- **Fail:** Inventory drops to -1 or below, a 500 error is returned by either request, or the results are inconsistent with 2 units consumed.
