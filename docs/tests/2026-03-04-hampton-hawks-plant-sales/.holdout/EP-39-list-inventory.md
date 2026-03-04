---
scenario_id: "EP-39"
title: "List Inventory with Search and Plant Info"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - inventory
---

## Description

Verify that `GET /api/inventory?search=Rose` returns inventory records with associated `PlantCatalog` information, filters correctly by search term, and supports pagination.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Inventory` and `PlantCatalog` entities and related services are registered in the DI container.
- No pre-existing inventory or plant records exist in the database.

## Steps

1. **Seed test data:** Insert 3 plants with corresponding inventory records:
   - Plant A: `{ sku: "PLT-500", name: "Rose Bush", variant: "Red", price: 12.50 }` with Inventory `{ onHandQty: 20 }`
   - Plant B: `{ sku: "PLT-501", name: "Tulip Bulb", variant: "Yellow", price: 8.00 }` with Inventory `{ onHandQty: 50 }`
   - Plant C: `{ sku: "PLT-502", name: "Daisy Mix", variant: "Assorted", price: 6.75 }` with Inventory `{ onHandQty: 30 }`

2. **Send request:** `GET /api/inventory?search=Rose`

3. **Verify filtered results:** Assert the response contains exactly 1 inventory record. Verify it includes PlantCatalog info:
   - Plant name is `"Rose Bush"`
   - Plant SKU is `"PLT-500"`
   - `onHandQty` is `20`

4. **Verify pagination:** Send `GET /api/inventory?search=Rose&page=1&pageSize=10` and confirm pagination metadata is present and correct (totalCount: 1).

5. **Verify no filter:** Send `GET /api/inventory` and confirm all 3 inventory records are returned, each with their associated PlantCatalog data.

6. **Verify empty search:** Send `GET /api/inventory?search=Orchid` and confirm 0 results returned with `success: true`.

## Expected Results

- `GET /api/inventory?search=Rose` returns `ApiResponse<T>` with `success: true` and `data` containing exactly 1 inventory record with embedded plant catalog information.
- Each inventory record includes the associated plant's name, SKU, and other catalog fields.
- Pagination metadata reflects the filtered count.
- Unfiltered queries return all 3 records.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP39"
```

## Pass/Fail Criteria

- **Pass:** Filtered results return only matching inventory records with correct PlantCatalog info, pagination is accurate, and all records are returned when unfiltered.
- **Fail:** Wrong number of results, missing PlantCatalog data, incorrect inventory quantities, or malformed response envelope.
