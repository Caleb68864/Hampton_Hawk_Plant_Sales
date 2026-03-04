---
scenario_id: "EP-42"
title: "Import plants CSV with valid and duplicate rows"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - import
---

# Scenario EP-42: Import plants CSV with valid and duplicate rows

## Description

Verifies that `POST /api/import/plants` processes a CSV file containing 3 plant rows: 2 valid and 1 with a duplicate SKU. The endpoint should create the 2 valid plants, record 1 ImportIssue for the duplicate, and return an ImportBatch with correct counts.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- One plant already exists in the database with SKU `"PLT-DUP"` (to trigger the duplicate).
- No other pre-existing plant records exist.

## Steps

1. **Seed existing data:** Insert 1 plant into the database:
   - Plant: `{ sku: "PLT-DUP", name: "Existing Rose", variant: "Red", price: 10.00, barcode: "9000000001", isActive: true }`

2. **Build CSV content:**
   ```csv
   Sku,Name,Variant,Price,Barcode,IsActive
   PLT-100,Tulip Bulb,Yellow,8.00,1000000100,true
   PLT-DUP,Duplicate Rose,Pink,12.00,9000000001,true
   PLT-101,Daisy Mix,Assorted,6.75,1000000101,true
   ```

3. **Send request:** `POST /api/import/plants` with the CSV file as a multipart form upload, `upsertBySku=false`.

4. **Assert response status:** HTTP 200 with `success: true`.

5. **Assert ImportResultResponse:**
   - `totalRows` = 3
   - `importedCount` = 2
   - `skippedCount` = 1
   - `issueCount` = 1
   - `batchId` is a valid GUID
   - `dryRun` = false

6. **Verify database plants:** Query `PlantCatalog` table. Confirm 3 total plants exist (1 pre-existing + 2 newly imported). Plants with SKUs `"PLT-100"` and `"PLT-101"` are present.

7. **Verify ImportBatch:** Query `ImportBatch` table by `batchId`. Confirm `Type` = `Plants`, `Filename` matches, `TotalRows` = 3, `ImportedCount` = 2, `SkippedCount` = 1.

8. **Verify ImportIssue:** Query `ImportIssue` table for the batch. Confirm 1 issue exists with `RowNumber` = 2, `Sku` = `"PLT-DUP"`, and a message indicating a duplicate SKU.

## Expected Results

- Response: `{ success: true, data: { batchId: "<guid>", totalRows: 3, importedCount: 2, skippedCount: 1, issueCount: 1, dryRun: false } }`
- 2 new plants created in the database (PLT-100, PLT-101).
- 1 ImportIssue recorded for the duplicate SKU row.
- ImportBatch record accurately reflects the import totals.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP42"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- 2 plants imported, 1 duplicate recorded as an ImportIssue, ImportBatch counts are accurate, response envelope is correct.
- **Fail:** Any assertion fails -- wrong import counts, missing ImportIssue, plants not created, or response envelope is malformed.
