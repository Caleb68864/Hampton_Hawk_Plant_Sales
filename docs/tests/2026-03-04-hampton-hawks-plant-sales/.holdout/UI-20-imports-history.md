---
scenario_id: "UI-20"
title: "Imports History"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Import History tab displays a table of past import batches with filename, counts, and date, and that clicking "View Issues" on a batch displays the ImportIssuesTable.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one import batch exists in the database, preferably including one with import issues/errors.

## Steps

1. Navigate to `http://localhost:5173/imports`.
2. Wait for the page to fully load.
3. Click the "Import History" tab.
4. Wait for the history table to load.
5. Verify the table displays batch records with columns for filename, counts (imported/skipped/errors), and date.
6. Verify at least one batch record is displayed.
7. Locate a batch that has issues (error count > 0).
8. Click the "View Issues" button or link for that batch.
9. Verify the ImportIssuesTable renders, displaying details about the import issues.
10. Verify the issues table shows relevant information (e.g., row number, field, error message).

## Expected Results

- The "Import History" tab shows a table of past import batches.
- Each batch row displays the filename, import counts, and date.
- Clicking "View Issues" on a batch with errors opens the ImportIssuesTable.
- The ImportIssuesTable displays detailed issue information.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** History table renders with batch records, "View Issues" opens the issues table with detailed information.
- **Fail:** History table does not render, batch records are missing fields, "View Issues" does not work, or errors occur.
