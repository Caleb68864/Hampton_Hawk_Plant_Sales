---
scenario_id: "UI-22"
title: "Settings Sale Closed Toggle"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the "Sale Closed" toggle on the Settings page triggers the AdminPinModal, accepts a valid PIN and reason, updates the toggle state, and reflects the sale status change in the UI.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- A valid admin PIN is known for authorization.
- The current sale status is known (open or closed).

## Steps

1. Navigate to `http://localhost:5173/settings`.
2. Wait for the page to fully load.
3. Locate the "Sale Closed" toggle/switch.
4. Note the current state of the toggle (on/off).
5. Click the "Sale Closed" toggle.
6. Verify the AdminPinModal dialog appears.
7. Verify the modal contains a PIN/password input and a reason field.
8. Type the valid admin PIN into the PIN field.
9. Type a reason into the reason field (e.g., "Closing sale for the season").
10. Click the "Authorize" or "Confirm" button.
11. Wait for the operation to process.
12. Verify the modal closes.
13. Verify the toggle state has changed (e.g., from off to on, or vice versa).
14. Verify the sale status text on the page updates to reflect the new state (e.g., "Sale is Closed" or "Sale is Open").

## Expected Results

- Clicking the "Sale Closed" toggle triggers the AdminPinModal.
- The modal requires both PIN and reason.
- Submitting a valid PIN and reason processes the change and closes the modal.
- The toggle state changes to reflect the new sale status.
- The sale status text on the page updates accordingly.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Toggle triggers AdminPinModal, PIN and reason are accepted, toggle state changes, and sale status text updates.
- **Fail:** Modal does not appear, PIN is rejected, toggle does not change, or sale status text does not update.
