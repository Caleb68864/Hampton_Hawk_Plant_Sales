---
scenario_id: "EP-45"
title: "Get import batches with pagination"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - import
---

# Scenario EP-45: Get import batches with pagination

## Description

Verifies that `GET /api/import/batches` returns a paginated list of import batches with the expected fields: `id`, `type`, `filename`, `totalRows`, `importedCount`, `skippedCount`, and `createdAt`.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- At least 3 ImportBatch records exist in the database with varying types (Plants, Inventory, Orders) and counts.

## Steps

1. **Seed test data:** Insert 3 ImportBatch records:
   - Batch 1: `{ type: "Plants", filename: "plants-2026.csv", totalRows: 50, importedCount: 48, skippedCount: 2 }`
   - Batch 2: `{ type: "Inventory", filename: "inventory-2026.csv", totalRows: 30, importedCount: 30, skippedCount: 0 }`
   - Batch 3: `{ type: "Orders", filename: "orders-2026.csv", totalRows: 100, importedCount: 95, skippedCount: 5 }`

2. **Send request:** `GET /api/import/batches?page=1&pageSize=2`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert pagination:** `data.items` contains exactly 2 records. `data.totalCount` = 3. `data.page` = 1. `data.pageSize` = 2. `data.totalPages` = 2.

5. **Assert batch fields:** Each item in `data.items` contains:
   - `id` (valid GUID)
   - `type` (non-empty string)
   - `filename` (non-empty string)
   - `totalRows` (integer >= 0)
   - `importedCount` (integer >= 0)
   - `skippedCount` (integer >= 0)
   - `createdAt` (valid DateTimeOffset)

6. **Send second page request:** `GET /api/import/batches?page=2&pageSize=2`

7. **Assert second page:** `data.items` contains exactly 1 record. `data.page` = 2.

## Expected Results

- Response: `{ success: true, data: { items: [...], totalCount: 3, page: 1, pageSize: 2, totalPages: 2 } }`
- Each batch item contains all required fields with correct types.
- Pagination correctly splits 3 records across 2 pages.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP45"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- batches returned with correct fields, pagination metadata is accurate, second page returns remaining records.
- **Fail:** Any assertion fails -- missing fields, incorrect pagination, wrong record count, or malformed response envelope.
