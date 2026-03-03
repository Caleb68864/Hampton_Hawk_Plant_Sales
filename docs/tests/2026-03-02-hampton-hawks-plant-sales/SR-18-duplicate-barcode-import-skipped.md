---
scenario_id: "SR-18"
title: "Duplicate barcode in plant import is skipped with ImportIssue"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-18: Duplicate barcode in plant import is skipped with ImportIssue

## Description
Verifies that when a CSV import contains a barcode that already exists in the system, the duplicate row is skipped and an ImportIssue of type DuplicateBarcode is reported rather than creating or overwriting the existing plant.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a plant via POST /api/plants with `barcode: "DUP001"` and any valid name and inventory value.
2. Confirm the plant exists via GET /api/plants and locate the entry with barcode DUP001.
3. Prepare a CSV file containing at least one row with `barcode: "DUP001"` (the duplicate) and optionally one row with a new unique barcode.
4. POST /api/import/plants with the CSV file as multipart/form-data (or the appropriate content type).
5. Assert the HTTP response status is 200 (import completed, even if partial).
6. Inspect the response body for an `importIssues` array (or equivalent field) containing an entry with type `DuplicateBarcode` referencing barcode `DUP001`.
7. Confirm the existing plant with barcode DUP001 was NOT overwritten (name and inventory unchanged) via GET /api/plants/{id}.
8. If a new unique barcode row was included in the CSV, confirm that row WAS imported successfully.

## Expected Results
- Step 4/5 returns HTTP 200.
- Step 6 shows at least one ImportIssue with type `DuplicateBarcode` for barcode `DUP001`.
- Step 7 confirms the original plant record is unchanged.
- Step 8 (if applicable) confirms non-duplicate rows were imported.

## Execution Tool
bash -- use curl with `-F` flag for multipart file upload; parse the JSON response with jq to check importIssues.

## Pass / Fail Criteria
- **Pass:** Import returns 200, a DuplicateBarcode ImportIssue is present for DUP001, and the existing plant record is unchanged.
- **Fail:** The duplicate row overwrites the existing plant, no ImportIssue is reported, or the import returns an error status.
