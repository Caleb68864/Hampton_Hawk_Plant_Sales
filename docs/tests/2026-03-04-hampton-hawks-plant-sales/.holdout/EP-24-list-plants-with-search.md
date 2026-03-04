---
scenario_id: "EP-24"
title: "List Plants with Search Filter"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - plants
---

## Description

Verify that `GET /api/plants?search=Rose` returns only plants whose name matches the search term, and that pagination parameters work correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `PlantCatalog` entity and related services are registered in the DI container.
- No pre-existing plant records exist in the database.

## Steps

1. **Seed test data:** Insert 3 plants into the database:
   - Plant A: `{ sku: "PLT-001", name: "Rose Bush", variant: "Red", price: 12.50, barcode: "1000000001", isActive: true }`
   - Plant B: `{ sku: "PLT-002", name: "Tulip Bulb", variant: "Yellow", price: 8.00, barcode: "1000000002", isActive: true }`
   - Plant C: `{ sku: "PLT-003", name: "Daisy Mix", variant: "Assorted", price: 6.75, barcode: "1000000003", isActive: true }`

2. **Send request:** `GET /api/plants?search=Rose`

3. **Verify filtered results:** Assert that the response contains exactly 1 plant and that its name is `"Rose Bush"`.

4. **Verify pagination:** Send `GET /api/plants?search=Rose&page=1&pageSize=10` and confirm pagination metadata is present and correct (totalCount: 1, page: 1).

5. **Verify empty search:** Send `GET /api/plants?search=Orchid` and confirm 0 results returned.

6. **Verify no filter:** Send `GET /api/plants` and confirm all 3 plants are returned.

## Expected Results

- `GET /api/plants?search=Rose` returns `ApiResponse<T>` with `success: true` and `data` containing exactly 1 plant record matching `"Rose Bush"`.
- Pagination metadata reflects the filtered count.
- Searching for a non-existent term returns an empty list with `success: true`.
- Omitting the search parameter returns all 3 plants.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP24"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- filtered results return only matching plants, pagination metadata is accurate, empty searches return zero results gracefully.
- **Fail:** Any assertion fails -- wrong number of results, missing pagination metadata, incorrect plant returned, or response envelope is malformed.
