---
scenario_id: "UI-19"
title: "Imports File Upload"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the file import flow: navigating to the imports page, selecting a CSV file for upload, confirming the file details are displayed, uploading, and verifying success or error feedback with the ImportResultsSummary.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- A valid CSV file is available for upload at a known path on the test machine.
- The CSV file format matches the expected import schema (e.g., customers, orders, or plants).

## Steps

1. Navigate to `http://localhost:5173/imports`.
2. Wait for the page to fully load.
3. Click the "Import Data" tab (if not already selected).
4. Verify the file upload area is visible (drag/drop zone or file select button).
5. Use the file input to select a CSV file (or simulate drag-and-drop).
6. Verify the selected file name is displayed in the upload area.
7. Verify the file size is displayed.
8. Click the "Upload" or "Import" button to start the upload.
9. Wait for the upload and processing to complete.
10. Verify feedback is displayed: either a success message or error details.
11. If successful, verify the ImportResultsSummary component renders showing counts (e.g., rows imported, rows skipped, errors).
12. If errors occurred, verify the error details are clearly displayed.

## Expected Results

- The "Import Data" tab shows the file upload interface.
- Selecting a CSV file displays its name and size.
- Uploading the file triggers processing and returns results.
- The ImportResultsSummary shows relevant counts (imported, skipped, errors).
- No unhandled console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** File selection shows name/size, upload processes correctly, ImportResultsSummary displays results.
- **Fail:** File selection does not work, upload fails without feedback, ImportResultsSummary does not render, or unhandled errors occur.
