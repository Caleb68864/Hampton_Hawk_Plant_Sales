---
scenario_id: "EP-46"
title: "Get import batch issues"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - import
---

# Scenario EP-46: Get import batch issues

## Description

Verifies that `GET /api/import/batches/{id}/issues` returns the list of ImportIssues for a specific batch, including `rowNumber`, `issueType`, `sku`, `barcode`, and `message` fields.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- One ImportBatch record exists with 3 associated ImportIssue records.

## Steps

1. **Seed test data:** Insert 1 ImportBatch and 3 associated ImportIssues:
   - Batch: `{ type: "Plants", filename: "plants-with-errors.csv", totalRows: 10, importedCount: 7, skippedCount: 3 }`
   - Issue 1: `{ rowNumber: 2, issueType: "DuplicateSku", sku: "PLT-DUP", message: "Duplicate SKU found" }`
   - Issue 2: `{ rowNumber: 5, issueType: "InvalidData", sku: "PLT-BAD", message: "Price must be greater than zero" }`
   - Issue 3: `{ rowNumber: 8, issueType: "MissingField", sku: null, message: "Name is required" }`

2. **Send request:** `GET /api/import/batches/{batchId}/issues`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert issues returned:** `data.items` contains exactly 3 issues.

5. **Assert issue fields for each item:**
   - `id` (valid GUID)
   - `rowNumber` (integer > 0)
   - `issueType` (non-empty string)
   - `message` (non-empty string)
   - `sku` (string or null)
   - `barcode` (string or null)
   - `rawData` (string or null)

6. **Verify specific issue data:**
   - Issue with `rowNumber` = 2 has `issueType` = `"DuplicateSku"` and `sku` = `"PLT-DUP"`
   - Issue with `rowNumber` = 5 has `issueType` = `"InvalidData"`
   - Issue with `rowNumber` = 8 has `message` containing `"required"`

7. **Verify pagination:** Send `GET /api/import/batches/{batchId}/issues?page=1&pageSize=2` and confirm only 2 issues returned with `totalCount` = 3.

## Expected Results

- Response: `{ success: true, data: { items: [...], totalCount: 3, ... } }`
- Each issue contains `rowNumber`, `issueType`, `message`, and optional `sku`/`barcode`/`rawData` fields.
- Issue data matches the seeded records.
- Pagination works correctly for batch issues.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP46"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- issues returned with correct fields, data matches seeded records, pagination works.
- **Fail:** Any assertion fails -- missing issues, wrong field values, or incorrect pagination.
