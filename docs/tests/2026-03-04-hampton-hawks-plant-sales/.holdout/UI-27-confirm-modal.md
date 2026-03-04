---
scenario_id: "UI-27"
title: "Confirm Modal"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the ConfirmModal component behavior: it appears when a destructive action (e.g., delete) is triggered, displays a title, message, and configurable buttons, supports cancel and confirm actions, and applies danger variant styling.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- A page is accessible that has a delete action triggering the ConfirmModal (e.g., deleting a plant, customer, or order).

## Steps

1. Navigate to a page with a delete action (e.g., `/plants/{id}` or `/customers/{id}`).
2. Wait for the page to fully load.
3. Locate and click the "Delete" button to trigger the ConfirmModal.
4. Verify the ConfirmModal appears as a dialog overlay.
5. Verify the modal displays a title (e.g., "Confirm Delete" or similar).
6. Verify the modal displays a descriptive message (e.g., "Are you sure you want to delete this item?").
7. Verify the modal has a "Cancel" button and a "Confirm" or "Delete" button.
8. Verify the confirm/delete button has danger variant styling (e.g., red background or red text).
9. Click the "Cancel" button.
10. Verify the modal closes.
11. Verify no action was taken (the item still exists on the page).
12. Click the "Delete" button again to reopen the ConfirmModal.
13. Click the "Confirm" or "Delete" button.
14. Wait for the action to process.
15. Verify the delete action executes (e.g., redirect to list page, item removed, or success message).

## Expected Results

- The ConfirmModal renders with a title, message, and two buttons (Cancel and Confirm).
- The confirm button has danger variant styling (red color scheme).
- Clicking Cancel closes the modal without performing the action.
- Clicking Confirm executes the delete action.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Modal appears with correct title, message, and styled buttons. Cancel closes without action. Confirm executes the delete.
- **Fail:** Modal does not appear, content is missing, styling is wrong, Cancel performs an action, Confirm does not execute, or errors occur.
