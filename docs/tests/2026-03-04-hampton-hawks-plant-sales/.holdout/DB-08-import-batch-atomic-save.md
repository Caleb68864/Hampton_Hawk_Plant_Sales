---
scenario_id: "DB-08"
title: "Import batch atomic save with mixed valid and invalid rows"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - import
  - database
---

# Scenario DB-08: Import batch atomic save with mixed valid and invalid rows

## Description

Verifies that the import process correctly handles a mix of valid and invalid rows: valid rows are persisted to the database, invalid rows are tracked as ImportIssues within the ImportBatch, and the batch status reflects accurate totals. Additionally verifies that when all rows fail, no partial data is persisted.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- No pre-existing plant records exist in the database.

## Steps

### Part 1: Mixed valid and invalid rows

1. **Build CSV content with mixed validity:**
   ```csv
   Sku,Name,Variant,Price,Barcode,IsActive
   PLT-OK1,Valid Rose,Red,10.00,2000000001,true
   ,Missing SKU,Blue,5.00,2000000002,true
   PLT-OK2,Valid Tulip,Yellow,8.00,2000000003,true
   PLT-BAD,,Pink,-5.00,,true
   ```

2. **Send request:** `POST /api/import/plants` with the CSV file as multipart form upload.

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert ImportResultResponse:**
   - `importedCount` = 2 (PLT-OK1, PLT-OK2)
   - `skippedCount` = 2 (rows 2 and 4)
   - `issueCount` = 2

5. **Verify valid rows persisted:** Query `PlantCatalog` and confirm plants with SKUs `"PLT-OK1"` and `"PLT-OK2"` exist.

6. **Verify ImportIssues:** Query `ImportIssue` for the batch. Confirm 2 issues exist:
   - One for the missing SKU row (row 2)
   - One for the invalid data row (row 4)

7. **Verify ImportBatch totals:** The `ImportBatch` record has `TotalRows` = 4, `ImportedCount` = 2, `SkippedCount` = 2.

### Part 2: All rows fail -- no partial data

8. **Build CSV content where all rows are invalid:**
   ```csv
   Sku,Name,Variant,Price,Barcode,IsActive
   ,Missing SKU 1,Blue,5.00,3000000001,true
   ,Missing SKU 2,Green,-1.00,3000000002,true
   ```

9. **Count plants before import:** Record the current count of `PlantCatalog` records.

10. **Send request:** `POST /api/import/plants` with the all-invalid CSV.

11. **Assert ImportResultResponse:**
    - `importedCount` = 0
    - `skippedCount` = 2
    - `issueCount` = 2

12. **Verify no new plants created:** Query `PlantCatalog` and confirm the count has not changed from step 9.

13. **Verify ImportBatch still created:** An `ImportBatch` record exists to document the failed import with `ImportedCount` = 0.

14. **Verify ImportIssues:** 2 ImportIssue records exist for this batch.

## Expected Results

- Mixed import: valid rows saved, invalid rows tracked as issues, batch totals correct.
- All-fail import: no partial plant data persisted, batch still recorded with importedCount=0, all rows tracked as issues.
- ImportBatch records always created regardless of success/failure.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~DB08"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- valid rows persisted, invalid rows tracked, no partial data on full failure, batch totals accurate in both scenarios.
- **Fail:** Any assertion fails -- valid rows missing, issues not recorded, partial data persisted on full failure, or batch totals incorrect.
