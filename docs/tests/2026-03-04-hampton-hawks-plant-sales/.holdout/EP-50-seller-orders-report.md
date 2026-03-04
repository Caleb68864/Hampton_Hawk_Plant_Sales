---
scenario_id: "EP-50"
title: "Seller orders report"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - reports
---

# Scenario EP-50: Seller orders report

## Description

Verifies that `GET /api/reports/seller/{sellerId}/orders` returns order summaries for a specific seller, including correct customer names, statuses, issue flags, and fulfillment progress. Orders belonging to other sellers should be excluded.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IReportService` and all related services are registered in the DI container.
- No pre-existing order records.

## Steps

1. **Seed test data:**
   - 2 sellers: Seller A (target) and Seller B
   - 2 customers: Customer X and Customer Y
   - 2 plants with inventory
   - 4 orders:
     - Order 1: Customer X, Seller A, status Open, 2 lines (ordered: 5, fulfilled: 0), hasIssue: false
     - Order 2: Customer Y, Seller A, status Completed, 1 line (ordered: 3, fulfilled: 3), hasIssue: false
     - Order 3: Customer X, Seller A, status InProgress, 1 line (ordered: 4, fulfilled: 2), hasIssue: true
     - Order 4: Customer Y, Seller B, status Open, 1 line (ordered: 2, fulfilled: 0), hasIssue: false

2. **Send request:** `GET /api/reports/seller/{sellerAId}/orders`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert result list:** `data` contains exactly 3 items (Orders 1, 2, 3 for Seller A).

5. **Assert SellerOrderSummaryResponse fields for each item:**
   - `orderId` (valid GUID)
   - `orderNumber` (non-empty string)
   - `customerName` (non-empty string)
   - `status` (valid OrderStatus)
   - `hasIssue` (boolean)
   - `totalItemsOrdered` (integer >= 0)
   - `totalItemsFulfilled` (integer >= 0)
   - `createdAt` (valid DateTimeOffset)

6. **Verify Order 1 data:** `customerName` matches Customer X, `totalItemsOrdered` = 5, `totalItemsFulfilled` = 0.

7. **Verify Order 2 data:** `customerName` matches Customer Y, `status` = Completed, `totalItemsOrdered` = 3, `totalItemsFulfilled` = 3.

8. **Verify Order 3 data:** `hasIssue` = true, `totalItemsOrdered` = 4, `totalItemsFulfilled` = 2.

9. **Verify Seller B's order excluded:** No item matching Order 4 in the results.

## Expected Results

- Response: `{ success: true, data: [ ... ] }` with 3 seller-specific order summaries.
- Each summary includes correct customer name, status, issue flag, and fulfillment totals.
- Orders from other sellers are excluded.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP50"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- correct orders returned for the target seller, fulfillment totals accurate, other sellers' orders excluded.
- **Fail:** Any assertion fails -- wrong orders returned, incorrect totals, or other sellers' data included.
