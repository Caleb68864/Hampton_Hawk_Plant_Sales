---
scenario_id: "UI-10"
title: "Inventory Inline Edit"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the inline editing functionality on the Inventory page: clicking an edit button reveals a number input, changing the quantity with a reason, saving, and confirming the updated quantity in the table.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one inventory record exists with a known on-hand quantity.

## Steps

1. Navigate to `http://localhost:5173/inventory`.
2. Wait for the inventory table to fully load.
3. Note the current quantity of the first inventory row.
4. Click the edit button (pencil icon or "Edit" text) on that row.
5. Verify an inline number input appears in the quantity cell, replacing the static text.
6. Clear the number input and type a new quantity value (e.g., "25").
7. Locate the reason input field (may appear inline or as a popover).
8. Type a reason for the change (e.g., "Recount correction").
9. Click the save/confirm button for the inline edit.
10. Wait for the save operation to complete.
11. Verify the quantity in the table row now shows "25".
12. Verify the row has returned to its non-editing (read-only) state.

## Expected Results

- Clicking the edit button reveals an inline number input for the quantity.
- The number input accepts a new value.
- A reason field is available and accepts text.
- Saving the edit updates the quantity in the table without a full page reload.
- The row returns to read-only mode after saving.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Inline edit activates, quantity can be changed with a reason, save updates the table row, and the row returns to read-only state.
- **Fail:** Inline edit does not activate, quantity cannot be changed, reason field is missing, save fails, or the table does not update.
