---
scenario_id: "UI-15"
title: "Pickup Manual Fulfill Modal"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the manual fulfillment modal on the pickup scan page: opening the modal, selecting an unfulfilled line from the dropdown, entering a reason, submitting, and confirming the line is marked as fulfilled.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- An order exists with at least one unfulfilled order line that has not been scanned.

## Steps

1. Navigate to `http://localhost:5173/pickup/{orderId}` where the order has unfulfilled lines.
2. Wait for the scan page to fully load.
3. Note which order lines are currently unfulfilled.
4. Locate and click the "Manual Fulfill" button.
5. Verify a modal dialog opens.
6. Verify the modal contains a dropdown for selecting an unfulfilled order line.
7. Verify the modal contains a reason textarea.
8. Click the unfulfilled line dropdown and select one of the unfulfilled lines.
9. Click into the reason textarea and type "Barcode damaged, verified manually".
10. Click the "Fulfill" button in the modal.
11. Wait for the fulfillment to process.
12. Verify the modal closes.
13. Verify the selected order line is now marked as fulfilled in the UI (e.g., checkmark, strikethrough, or status change).
14. Verify the ItemsRemainingCounter has decremented accordingly.

## Expected Results

- The "Manual Fulfill" button opens a modal dialog.
- The modal contains a dropdown with unfulfilled order lines and a reason textarea.
- Selecting a line and entering a reason allows the fulfillment to be submitted.
- The modal closes after successful submission.
- The order line is visually marked as fulfilled.
- The items remaining counter updates.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Modal opens with dropdown and reason field, manual fulfillment succeeds, modal closes, line is marked fulfilled, counter updates.
- **Fail:** Modal does not open, dropdown is empty, fulfillment fails, line is not marked, or errors occur.
