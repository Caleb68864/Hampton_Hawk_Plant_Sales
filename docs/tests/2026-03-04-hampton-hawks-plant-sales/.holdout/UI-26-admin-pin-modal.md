---
scenario_id: "UI-26"
title: "Admin PIN Modal"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the AdminPinModal behavior: it shows a password input and reason textarea when triggered, validates that both fields are required, submits successfully when both are provided, and can be cancelled.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- An admin-protected action is available to trigger the modal (e.g., "Force Complete" on an order, "Sale Closed" toggle on settings).

## Steps

1. Navigate to a page with an admin-protected action (e.g., `/pickup/{orderId}` with unfulfilled lines or `/settings`).
2. Wait for the page to fully load.
3. Trigger the admin action (e.g., click "Force Complete" or the "Sale Closed" toggle).
4. Verify the AdminPinModal appears as a dialog overlay.
5. Verify the modal contains a password/PIN input field.
6. Verify the modal contains a reason textarea.
7. Without entering any values, click the "Authorize" or "Submit" button.
8. Verify a validation error message appears indicating the PIN is required.
9. Type a PIN value into the PIN field but leave the reason field empty.
10. Click the "Authorize" or "Submit" button again.
11. Verify a validation error or message appears indicating the reason is required.
12. Clear both fields.
13. Locate the "Cancel" button in the modal.
14. Click the "Cancel" button.
15. Verify the modal closes without performing any action.
16. Trigger the admin action again to reopen the modal.
17. Type a valid PIN into the PIN field.
18. Type a reason into the reason field (e.g., "Authorized action").
19. Click the "Authorize" or "Submit" button.
20. Verify the modal closes and the action proceeds.

## Expected Results

- The AdminPinModal renders with a password input and reason textarea.
- Submitting with empty fields shows validation errors.
- Submitting with only PIN shows a reason-required message.
- Clicking Cancel closes the modal without side effects.
- Entering both PIN and reason and submitting closes the modal and processes the action.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Modal renders correctly, validation enforces both fields, Cancel closes without action, and valid submission processes the action.
- **Fail:** Modal does not render, validation is missing, Cancel does not close the modal, or valid submission fails.
