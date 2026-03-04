---
scenario_id: "UI-09"
title: "Seller Detail Edit"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify that a seller's details (grade, teacher) can be edited on the detail page, saved successfully, and that changes persist after reloading.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one seller exists with a known ID.

## Steps

1. Navigate to `http://localhost:5173/sellers/{id}` where `{id}` is a known seller ID.
2. Wait for the seller detail page to fully load.
3. Verify the current grade and teacher values are displayed in editable fields.
4. Clear the grade field and type a new value (e.g., "5th").
5. Clear the teacher field and type a new value (e.g., "Mrs. Anderson").
6. Click the "Save" button.
7. Wait for the save operation to complete.
8. Verify a success feedback indicator appears (e.g., toast notification, success message).
9. Reload the page by navigating to the same URL again.
10. Wait for the page to fully load.
11. Verify the grade field shows "5th".
12. Verify the teacher field shows "Mrs. Anderson".

## Expected Results

- The seller detail page loads with pre-filled editable fields for grade and teacher.
- Editing the fields works correctly.
- Clicking Save triggers a successful API call and shows success feedback.
- After reloading, the updated values persist.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Grade and teacher fields are editable, save completes with feedback, and reloaded page reflects the updated values.
- **Fail:** Fields are not editable, save fails, no success feedback appears, or reloaded page does not show the updated values.
