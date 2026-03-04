---
scenario_id: "UI-18"
title: "Walk-Up Availability Display"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the walk-up availability display: the availability table shows plant names with available quantities, the "Refresh Availability" button works, and the "Show unavailable items" toggle controls visibility of zero-quantity plants.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- Inventory records exist with a mix of available and unavailable (zero quantity) plants.

## Steps

1. Navigate to `http://localhost:5173/walkup/new`.
2. Wait for the page to fully load and the availability table to render.
3. Verify the availability table is visible and shows plant names with their available quantities.
4. Verify that plants with available quantity > 0 are displayed.
5. Locate the "Refresh Availability" button.
6. Click the "Refresh Availability" button.
7. Verify the table refreshes (may show a loading indicator briefly, then data reloads).
8. Verify the data is still displayed correctly after refresh.
9. Locate the "Show unavailable items" checkbox or toggle.
10. Verify its current state (likely unchecked/off by default).
11. Click the "Show unavailable items" toggle to enable it.
12. Verify that plants with zero available quantity now appear in the table.
13. Click the toggle again to disable it.
14. Verify that zero-quantity plants are hidden again.

## Expected Results

- The availability table displays plant names alongside their available walk-up quantities.
- The "Refresh Availability" button reloads the availability data.
- The "Show unavailable items" toggle controls whether zero-quantity plants are displayed.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Availability table renders with correct data, refresh works, and the unavailable items toggle correctly shows/hides zero-quantity plants.
- **Fail:** Table does not render, refresh fails, toggle does not work, or console errors occur.
