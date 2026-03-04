---
scenario_id: "UI-05"
title: "Customer Detail Edit"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify that a customer's details can be edited (displayName, phone, email), saved successfully with feedback, and that changes persist after a page reload.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one customer exists with a known ID.

## Steps

1. Navigate to `http://localhost:5173/customers/{id}` where `{id}` is a known customer ID.
2. Wait for the customer detail page to fully load.
3. Verify the current displayName, phone, and email values are shown in editable fields.
4. Clear the displayName field and type a new value (e.g., "Updated Test Customer").
5. Clear the phone field and type a new value (e.g., "555-999-1234").
6. Clear the email field and type a new value (e.g., "updated@test.com").
7. Click the "Save" button.
8. Wait for the save operation to complete.
9. Verify a success feedback indicator appears (e.g., toast notification, success message, or green banner).
10. Reload the page by navigating to the same URL again.
11. Wait for the page to fully load.
12. Verify the displayName field shows "Updated Test Customer".
13. Verify the phone field shows "555-999-1234".
14. Verify the email field shows "updated@test.com".

## Expected Results

- The customer detail page loads with pre-filled editable fields.
- Editing displayName, phone, and email fields works correctly.
- Clicking Save triggers a successful API call and displays success feedback.
- After reloading the page, all edited values persist and are displayed correctly.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** All three fields are editable, save completes with success feedback, and reloaded page shows the updated values.
- **Fail:** Fields are not editable, save fails or shows no feedback, or reloaded page does not reflect the changes.
