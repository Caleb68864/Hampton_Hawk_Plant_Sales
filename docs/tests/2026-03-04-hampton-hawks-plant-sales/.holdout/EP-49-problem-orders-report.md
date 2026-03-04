---
scenario_id: "EP-49"
title: "Problem orders report"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - reports
---

# Scenario EP-49: Problem orders report

## Description

Verifies that `GET /api/reports/problem-orders` returns only orders that have `HasIssue=true`. Orders without issues should be excluded from the results.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IReportService` and all related services are registered in the DI container.
- No pre-existing order records.

## Steps

1. **Seed test data:** Create customers, sellers, plants, and 4 orders:
   - Order 1: `{ orderNumber: "ORD-001", hasIssue: true, status: Open }` with 2 lines
   - Order 2: `{ orderNumber: "ORD-002", hasIssue: false, status: Open }` with 1 line
   - Order 3: `{ orderNumber: "ORD-003", hasIssue: true, status: InProgress }` with 3 lines
   - Order 4: `{ orderNumber: "ORD-004", hasIssue: false, status: Completed }` with 1 line

2. **Send request:** `GET /api/reports/problem-orders`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert result list:** `data` contains exactly 2 items (Order 1 and Order 3).

5. **Assert ProblemOrderResponse fields for each item:**
   - `id` (valid GUID)
   - `orderNumber` (non-empty string)
   - `customerName` (non-empty string)
   - `sellerName` (string or null)
   - `status` (valid OrderStatus)
   - `lineCount` (integer > 0)
   - `createdAt` (valid DateTimeOffset)

6. **Verify Order 1 present:** An item with `orderNumber` = `"ORD-001"` and `lineCount` = 2.

7. **Verify Order 3 present:** An item with `orderNumber` = `"ORD-003"` and `lineCount` = 3.

8. **Verify non-problem orders excluded:** No items with `orderNumber` `"ORD-002"` or `"ORD-004"`.

## Expected Results

- Response: `{ success: true, data: [ { orderNumber: "ORD-001", lineCount: 2, ... }, { orderNumber: "ORD-003", lineCount: 3, ... } ] }`
- Only orders with `HasIssue=true` are returned.
- Each result includes order metadata and line count.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP49"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- only problem orders returned, correct line counts, non-problem orders excluded.
- **Fail:** Any assertion fails -- non-problem orders included, missing problem orders, or incorrect field values.
