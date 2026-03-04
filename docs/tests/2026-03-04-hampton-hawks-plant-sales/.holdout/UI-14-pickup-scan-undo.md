---
scenario_id: "UI-14"
title: "Pickup Scan Undo"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify that after a successful barcode scan, the "Undo last scan" button reverses the scan, shows undo success feedback, and increments the items remaining counter back to its previous value.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- An order exists with at least one unfulfilled order line.
- A successful scan has just been performed on this order (or will be performed as the first step).

## Steps

1. Navigate to `http://localhost:5173/pickup/{orderId}` where the order has unfulfilled lines.
2. Wait for the scan page to fully load.
3. Note the current value of the ItemsRemainingCounter (e.g., 5).
4. Perform a successful scan by typing a valid barcode and pressing Enter.
5. Verify the ItemsRemainingCounter decremented (e.g., now shows 4).
6. Locate the "Undo last scan" button.
7. Click the "Undo last scan" button.
8. Wait for the undo operation to process.
9. Verify feedback indicates the undo was successful (e.g., ScanFeedbackBanner shows undo confirmation).
10. Verify the ItemsRemainingCounter has incremented back to the previous value (e.g., back to 5).
11. Verify the scan entry has been removed from or marked in the ScanHistoryList.

## Expected Results

- The "Undo last scan" button is visible after a successful scan.
- Clicking undo reverses the last scan operation.
- Feedback confirms the undo was successful.
- The ItemsRemainingCounter increments back to its pre-scan value.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Undo button is available, clicking it reverses the scan, feedback shows success, and items remaining counter returns to its original value.
- **Fail:** Undo button is missing, undo fails, no feedback appears, or the counter does not increment back.
