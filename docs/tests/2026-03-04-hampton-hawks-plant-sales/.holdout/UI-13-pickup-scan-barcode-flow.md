---
scenario_id: "UI-13"
title: "Pickup Scan Barcode Flow"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the barcode scanning flow on the pickup scan page: focusing the scan input, entering a barcode, observing the accepted feedback, verifying the items remaining counter decrements, and confirming the scan appears in the scan history list.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- An order exists with at least one unfulfilled order line.
- The barcode for one of the unfulfilled plants is known.

## Steps

1. Navigate to `http://localhost:5173/pickup/{orderId}` where `{orderId}` is the known order with unfulfilled lines.
2. Wait for the scan page to fully load.
3. Note the current value of the ItemsRemainingCounter.
4. Locate the scan/barcode input field.
5. Click on the scan input to focus it.
6. Type the known barcode value into the input field.
7. Press the Enter key to submit the scan.
8. Wait for the scan to process.
9. Verify the ScanFeedbackBanner appears with an "Accepted" or success message.
10. Verify the ItemsRemainingCounter has decremented by 1 compared to the initial value.
11. Locate the ScanHistoryList on the page.
12. Verify the most recent entry in the ScanHistoryList shows the scanned plant/barcode.

## Expected Results

- The scan input field is focusable and accepts barcode text input.
- Pressing Enter submits the barcode for processing.
- A ScanFeedbackBanner displays an "Accepted" message indicating a successful scan.
- The ItemsRemainingCounter decrements by 1.
- The ScanHistoryList shows the new scan entry at the top.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Barcode is accepted, feedback banner shows success, items remaining decrements, and scan history updates.
- **Fail:** Barcode is not accepted, no feedback appears, counter does not decrement, scan history does not update, or errors occur.
