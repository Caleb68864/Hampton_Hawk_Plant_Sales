---
scenario_id: "EP-13"
title: "Reports dashboard metrics"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-13: Reports dashboard metrics

## Description
Verifies that the reports endpoints return well-structured responses with the expected metric fields. These endpoints must respond successfully even when the database is empty (returning zero counts or empty arrays).

## Preconditions
- API is running at http://localhost:8080
- Database may be empty or contain existing data -- both states are valid for this test

## Steps
1. Call `GET /api/reports/dashboard-metrics`.
2. Verify the response returns HTTP 200 and `success: true`.
3. Verify the `data` object contains the field `totalOrders` (numeric, >= 0).
4. Verify the `data` object contains the field `openOrders` (numeric, >= 0).
5. Verify the `data` object contains the field `completedOrders` (numeric, >= 0).
6. Verify the `data` object contains the field `totalCustomers` (numeric, >= 0).
7. Verify the `data` object contains the field `totalSellers` (numeric, >= 0).
8. Call `GET /api/reports/low-inventory`.
9. Verify the response returns HTTP 200 and `success: true`.
10. Verify the `data` field is an array (may be empty).
11. Call `GET /api/reports/problem-orders`.
12. Verify the response returns HTTP 200 and `success: true`.
13. Verify the `data` field is an array (may be empty).

## Expected Results
- `GET /api/reports/dashboard-metrics` returns HTTP 200 with a `data` object containing all five numeric metric fields (`totalOrders`, `openOrders`, `completedOrders`, `totalCustomers`, `totalSellers`), each with a value >= 0.
- `GET /api/reports/low-inventory` returns HTTP 200 with `data` as an array (empty or populated).
- `GET /api/reports/problem-orders` returns HTTP 200 with `data` as an array (empty or populated).

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All three endpoints return HTTP 200; dashboard-metrics contains all five required numeric fields; low-inventory and problem-orders return arrays.
- **Fail:** Any endpoint returns a non-200 status, a required metric field is missing from dashboard-metrics, or low-inventory / problem-orders do not return an array type.
