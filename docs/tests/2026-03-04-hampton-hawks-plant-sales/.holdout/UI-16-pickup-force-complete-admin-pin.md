---
scenario_id: "UI-16"
title: "Pickup Force Complete with Admin PIN"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the Force Complete flow on an order with unfulfilled lines: clicking "Force Complete" triggers the AdminPinModal, entering a valid PIN and reason authorizes the action, and the order status changes to Complete.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- An order exists with at least one unfulfilled order line.
- A valid admin PIN is known for authorization.

## Steps

1. Navigate to `http://localhost:5173/pickup/{orderId}` where the order has unfulfilled lines.
2. Wait for the scan page to fully load.
3. Verify there are unfulfilled lines (ItemsRemainingCounter > 0).
4. Locate and click the "Force Complete" button.
5. Verify the AdminPinModal dialog opens.
6. Verify the modal contains a PIN/password input field.
7. Verify the modal contains a reason textarea or input.
8. Type the valid admin PIN into the PIN field.
9. Type a reason into the reason field (e.g., "Customer confirmed all items received").
10. Click the "Authorize" or "Confirm" button in the modal.
11. Wait for the authorization and force-complete operation to process.
12. Verify the modal closes.
13. Verify the order status has changed to "Complete" (visible in the UI as a status chip, banner, or text).
14. Verify the page reflects the completed state (e.g., scan input disabled, action buttons hidden or changed).

## Expected Results

- The "Force Complete" button triggers the AdminPinModal.
- The modal requires both a PIN and a reason.
- Entering a valid PIN and reason and clicking Authorize processes the force-complete action.
- The modal closes and the order status updates to "Complete".
- The UI reflects the completed state appropriately.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** AdminPinModal opens, PIN and reason are accepted, force-complete processes, order status becomes Complete.
- **Fail:** Modal does not open, PIN is rejected, force-complete fails, or order status does not change.
