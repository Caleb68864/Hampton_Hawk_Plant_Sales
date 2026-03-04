---
scenario_id: "EP-43"
title: "Import inventory CSV updates OnHandQty"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - import
---

# Scenario EP-43: Import inventory CSV updates OnHandQty

## Description

Verifies that `POST /api/import/inventory` processes a CSV file containing inventory rows mapped to existing plant SKUs and updates their `OnHandQty` correctly. Non-existent SKUs should create ImportIssues rather than crashing the import.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IImportService` and all related services are registered in the DI container.
- Two plants exist in the database with associated Inventory records:
  - Plant A: `{ sku: "PLT-A", name: "Rose Bush" }` with Inventory `{ onHandQty: 5 }`
  - Plant B: `{ sku: "PLT-B", name: "Tulip Bulb" }` with Inventory `{ onHandQty: 10 }`
- No plant exists with SKU `"PLT-MISSING"`.

## Steps

1. **Seed existing data:** Insert 2 plants with corresponding Inventory records as described in preconditions.

2. **Build CSV content:**
   ```csv
   Sku,OnHandQty
   PLT-A,20
   PLT-B,15
   PLT-MISSING,50
   ```

3. **Send request:** `POST /api/import/inventory` with the CSV file as a multipart form upload.

4. **Assert response status:** HTTP 200 with `success: true`.

5. **Assert ImportResultResponse:**
   - `totalRows` = 3
   - `importedCount` = 2
   - `skippedCount` = 1
   - `issueCount` = 1

6. **Verify Inventory updates:** Query the `Inventory` table:
   - Plant A (PLT-A): `OnHandQty` = 20
   - Plant B (PLT-B): `OnHandQty` = 15

7. **Verify ImportIssue:** Query `ImportIssue` for the batch. Confirm 1 issue exists for `RowNumber` = 3, `Sku` = `"PLT-MISSING"`, with a message indicating the SKU was not found.

8. **Verify ImportBatch:** Confirm batch record has `Type` = `Inventory` and correct counts.

## Expected Results

- Response: `{ success: true, data: { totalRows: 3, importedCount: 2, skippedCount: 1, issueCount: 1, dryRun: false } }`
- Inventory for PLT-A updated to OnHandQty=20.
- Inventory for PLT-B updated to OnHandQty=15.
- 1 ImportIssue recorded for the non-existent SKU.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP43"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- existing inventory quantities updated, non-existent SKU tracked as an issue, response counts are accurate.
- **Fail:** Any assertion fails -- inventory not updated, missing ImportIssue for non-existent SKU, or incorrect import counts.
