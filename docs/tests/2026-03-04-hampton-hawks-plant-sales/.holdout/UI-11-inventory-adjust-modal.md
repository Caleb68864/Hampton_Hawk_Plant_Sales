---
scenario_id: "UI-11"
title: "Inventory Adjust Modal"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the inventory adjustment modal opens correctly, accepts a delta quantity and reason, applies the adjustment, and updates the displayed quantity.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one inventory record exists with a known on-hand quantity (e.g., 20).

## Steps

1. Navigate to `http://localhost:5173/inventory`.
2. Wait for the inventory table to fully load.
3. Note the current quantity of a specific inventory row (e.g., 20).
4. Click the "Adjust" button for that row.
5. Verify a modal dialog opens.
6. Verify the modal contains a deltaQty input field and a reason text field.
7. Clear the deltaQty field and type "-3".
8. Click into the reason field and type "Damaged".
9. Click the "Apply Adjustment" button in the modal.
10. Wait for the adjustment to process.
11. Verify the modal closes.
12. Verify the quantity in the inventory table row has decreased by 3 (e.g., from 20 to 17).

## Expected Results

- The Adjust button opens a modal dialog.
- The modal contains deltaQty and reason input fields.
- Entering -3 as the delta and "Damaged" as the reason is accepted.
- Clicking "Apply Adjustment" processes the adjustment and closes the modal.
- The inventory table row shows the updated quantity (original minus 3).
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Modal opens with correct fields, adjustment is applied, modal closes, and table shows updated quantity reduced by 3.
- **Fail:** Modal does not open, fields are missing, adjustment fails, modal does not close, or quantity is not updated correctly.
