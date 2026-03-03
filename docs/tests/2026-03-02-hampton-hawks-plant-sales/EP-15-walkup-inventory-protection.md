---
scenario_id: "EP-15"
title: "Walk-up inventory protection"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario EP-15: Walk-up inventory protection

## Description
Verifies that the walk-up system protects pre-ordered inventory: available walk-up quantity equals on-hand minus pre-ordered quantity, over-ordering is blocked, and an admin PIN override allows exceeding availability while flagging the order line with `HasIssue: true`. Steps must run in order due to state dependencies.

## Preconditions
- API is running at http://localhost:8080
- Admin PIN is `1234`
- No conflicting inventory records for the test plant

## Steps
1. Create a new plant via `POST /api/plants` with a unique name (e.g. `Inventory Protection Plant`). Record the returned `id` as `{plantId}`.
2. Set inventory for the plant with `onHandQty: 10` via the inventory endpoint. Record the inventory `id` if needed.
3. Create a customer and a pre-order (non-walk-up) that includes a line for `{plantId}` with `qtyOrdered: 8` (using the standard orders endpoint, not walk-up).
4. Call `GET /api/walkup/availability` and verify the plant shows `AvailableForWalkup: 2` (10 on-hand minus 8 pre-ordered).
5. Create a walk-up order via `POST /api/walkup/orders` with minimal customer info. Record the returned `id` as `{walkupOrderId}`.
6. Attempt `POST /api/walkup/orders/{walkupOrderId}/lines` with `plantCatalogId: {plantId}` and `qty: 3` (exceeds available by 1).
7. Verify the response returns HTTP 400 and `success: false`.
8. Verify the `errors` array contains a message indicating insufficient available quantity.
9. Attempt `POST /api/walkup/orders/{walkupOrderId}/lines` with `plantCatalogId: {plantId}` and `qty: 2` (exactly at available limit).
10. Verify the response returns HTTP 200 (or 201) and `success: true`.
11. Verify the line is created without `HasIssue: true` (or `hasIssue` is `false`).
12. Create a second walk-up order via `POST /api/walkup/orders`. Record the returned `id` as `{walkupOrderId2}`.
13. Attempt `POST /api/walkup/orders/{walkupOrderId2}/lines` with `plantCatalogId: {plantId}`, `qty: 5`, and the headers `X-Admin-Pin: 1234` and `X-Admin-Reason: EP-15 admin override test`.
14. Verify the response returns HTTP 200 (or 201) and `success: true`.
15. Verify the returned line has `HasIssue: true` (or `hasIssue: true`).

## Expected Results
- `GET /api/walkup/availability` shows `AvailableForWalkup: 2` for a plant with 10 on-hand and 8 pre-ordered.
- Adding a walk-up line for qty=3 (exceeds available) returns HTTP 400 with an error message.
- Adding a walk-up line for qty=2 (at limit) succeeds without `HasIssue`.
- Adding a walk-up line for qty=5 with admin PIN succeeds and sets `HasIssue: true` on the line.

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** Availability calculation is correct (10 - 8 = 2); over-limit request without PIN returns 400; at-limit request succeeds cleanly; admin PIN override succeeds and sets `HasIssue: true`.
- **Fail:** Availability calculation is wrong, an over-limit request without PIN succeeds, an at-limit request is incorrectly rejected, or the admin override does not set `HasIssue: true`.
