---
scenario_id: "EP-28"
title: "Soft Delete Plant"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - plants
  - soft-delete
---

## Description

Verify that `DELETE /api/plants/{id}` performs a soft delete by setting `DeletedAt`, excludes the record from default queries, and includes it when `includeDeleted=true` is specified.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `PlantCatalog` entity and related services are registered in the DI container.
- No pre-existing plant records exist in the database.

## Steps

1. **Seed test data:** Insert 2 plants into the database:
   - Plant A: `{ sku: "PLT-400", name: "Fern", variant: "Boston", price: 11.00, barcode: "5000000001", isActive: true }`
   - Plant B: `{ sku: "PLT-401", name: "Cactus", variant: "Barrel", price: 7.50, barcode: "5000000002", isActive: true }`

2. **Send delete request:** `DELETE /api/plants/{plantA.id}` with required admin headers (`X-Admin-Pin`, `X-Admin-Reason`).

3. **Verify soft delete response:** Assert `success: true`.

4. **Verify DeletedAt set:** Query the database directly (bypassing query filters via `.IgnoreQueryFilters()`) for Plant A. Assert:
   - `DeletedAt` is not null
   - `DeletedAt` is a recent timestamp

5. **Verify excluded from default GET:** Send `GET /api/plants`. Assert that only Plant B is returned (1 result total). Plant A should not appear.

6. **Verify included with includeDeleted:** Send `GET /api/plants?includeDeleted=true`. Assert that both Plant A and Plant B are returned (2 results total). Plant A should have `deletedAt` populated.

## Expected Results

- `DELETE /api/plants/{id}` returns `ApiResponse<T>` with `success: true`.
- The plant's `DeletedAt` field is set to a non-null timestamp.
- Default `GET /api/plants` excludes the soft-deleted plant.
- `GET /api/plants?includeDeleted=true` includes the soft-deleted plant with its `deletedAt` timestamp visible.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP28"
```

## Pass/Fail Criteria

- **Pass:** `DeletedAt` is set, the plant is excluded from default queries, and it is included when `includeDeleted=true`.
- **Fail:** `DeletedAt` is null after deletion, the plant still appears in default queries, or it is missing from `includeDeleted=true` queries.
