---
scenario_id: "EP-47"
title: "Dashboard metrics endpoint"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - reports
---

# Scenario EP-47: Dashboard metrics endpoint

## Description

Verifies that `GET /api/reports/dashboard-metrics` returns accurate aggregate metrics including total orders, open/completed order counts, customer/seller counts, low inventory count, problem order count, orders by status breakdown, total items ordered, total items fulfilled, and sale progress percentage.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IReportService` and all related services are registered in the DI container.
- Test data includes orders in various statuses, customers, sellers, plants with inventory, and at least one order with `HasIssue=true`.

## Steps

1. **Seed test data:**
   - 2 customers, 2 sellers
   - 3 plants with inventory (one with OnHandQty=2 to trigger low inventory)
   - 5 orders:
     - 2 with status `Open` (total ordered items: 6)
     - 1 with status `InProgress` (total ordered: 3, fulfilled: 1)
     - 1 with status `Completed` (total ordered: 4, fulfilled: 4)
     - 1 with status `Open` and `HasIssue=true` (total ordered: 2)
   - Total items ordered = 15, total items fulfilled = 5

2. **Send request:** `GET /api/reports/dashboard-metrics`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert DashboardMetricsResponse fields:**
   - `totalOrders` = 5
   - `openOrders` = 3 (2 Open + 1 Open with HasIssue)
   - `completedOrders` = 1
   - `totalCustomers` = 2
   - `totalSellers` = 2
   - `lowInventoryCount` >= 1
   - `problemOrderCount` >= 1
   - `ordersByStatus` contains keys for each status with correct counts
   - `totalItemsOrdered` = 15
   - `totalItemsFulfilled` = 5
   - `saleProgressPercent` is approximately 33.33 (5/15 * 100)

5. **Verify response envelope:** Response matches `ApiResponse<DashboardMetricsResponse>` shape with `success`, `data`, and `errors` fields.

## Expected Results

- Response: `{ success: true, data: { totalOrders: 5, openOrders: 3, completedOrders: 1, totalCustomers: 2, totalSellers: 2, ... } }`
- All metrics accurately reflect the seeded test data.
- `saleProgressPercent` is calculated correctly based on fulfilled vs ordered totals.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP47"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- all metric fields present with correct values matching the seeded data, response envelope is well-formed.
- **Fail:** Any assertion fails -- incorrect counts, missing fields, wrong progress percentage, or malformed response.
