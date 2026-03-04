---
scenario_id: "EP-48"
title: "Low inventory report with threshold filter"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - reports
---

# Scenario EP-48: Low inventory report with threshold filter

## Description

Verifies that `GET /api/reports/low-inventory?threshold=5` returns only plants whose `OnHandQty` is at or below the specified threshold. Plants with inventory above the threshold should be excluded.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IReportService` and all related services are registered in the DI container.
- No pre-existing plant or inventory records.

## Steps

1. **Seed test data:** Insert 3 plants with corresponding Inventory records:
   - Plant A: `{ sku: "PLT-LOW", name: "Low Rose", onHandQty: 2 }`
   - Plant B: `{ sku: "PLT-EDGE", name: "Edge Tulip", onHandQty: 5 }`
   - Plant C: `{ sku: "PLT-HIGH", name: "High Daisy", onHandQty: 10 }`

2. **Send request:** `GET /api/reports/low-inventory?threshold=5`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert result list:** `data` contains exactly 2 items (Plant A and Plant B).

5. **Assert LowInventoryResponse fields for each item:**
   - `plantCatalogId` (valid GUID)
   - `plantName` (non-empty string)
   - `sku` (non-empty string)
   - `onHandQty` (integer <= 5)

6. **Verify Plant A present:** An item with `sku` = `"PLT-LOW"` and `onHandQty` = 2.

7. **Verify Plant B present:** An item with `sku` = `"PLT-EDGE"` and `onHandQty` = 5.

8. **Verify Plant C excluded:** No item with `sku` = `"PLT-HIGH"` in the results.

9. **Test different threshold:** Send `GET /api/reports/low-inventory?threshold=2` and assert only 1 result (Plant A with onHandQty=2).

## Expected Results

- With threshold=5: exactly 2 plants returned (OnHandQty 2 and 5), plant with OnHandQty=10 excluded.
- With threshold=2: exactly 1 plant returned (OnHandQty=2).
- Each result item contains `plantCatalogId`, `plantName`, `sku`, and `onHandQty`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP48"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- correct plants returned at each threshold, boundary value (5) is included, above-threshold plants excluded.
- **Fail:** Any assertion fails -- wrong number of results, boundary value excluded/included incorrectly, or missing response fields.
