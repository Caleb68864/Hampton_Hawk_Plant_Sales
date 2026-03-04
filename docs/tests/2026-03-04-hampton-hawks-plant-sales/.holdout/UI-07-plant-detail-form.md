---
scenario_id: "UI-07"
title: "Plant Detail Form"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the complete plant creation and edit flow: filling out the new plant form with all fields, saving, verifying creation, and then navigating to the edit form to confirm values are pre-filled.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- The user has access to the plants section of the application.

## Steps

1. Navigate to `http://localhost:5173/plants/new`.
2. Wait for the new plant form to fully load.
3. Locate the "Name" field and type "Test Lavender Plant".
4. Locate the "SKU" field and type "TLP-001".
5. Locate the "Barcode" field and type "1234567890123".
6. Locate the "Variant" field and type "Purple".
7. Locate the "Price" field and type "12.99".
8. Locate the "isActive" checkbox/toggle and ensure it is checked/enabled.
9. Click the "Save" button.
10. Wait for the save operation to complete.
11. Verify a success indicator appears (toast, message, or redirect).
12. Verify the plant was created (either by redirect to detail page or by confirmation message).
13. Note the new plant's ID from the URL or response.
14. Navigate to `http://localhost:5173/plants/{newPlantId}`.
15. Wait for the edit form to fully load.
16. Verify the "Name" field is pre-filled with "Test Lavender Plant".
17. Verify the "SKU" field is pre-filled with "TLP-001".
18. Verify the "Barcode" field is pre-filled with "1234567890123".
19. Verify the "Variant" field is pre-filled with "Purple".
20. Verify the "Price" field is pre-filled with "12.99".
21. Verify the "isActive" checkbox/toggle reflects the checked/enabled state.

## Expected Results

- The new plant form renders with all expected fields (name, SKU, barcode, variant, price, isActive).
- All fields accept input correctly.
- Saving the form creates a new plant and provides success feedback.
- Navigating to the plant's detail/edit page shows the form pre-filled with all the values entered during creation.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** All form fields accept input, save creates the plant, and the edit form shows all pre-filled values matching what was entered.
- **Fail:** Any field does not accept input, save fails, or the edit form does not show correct pre-filled values.
