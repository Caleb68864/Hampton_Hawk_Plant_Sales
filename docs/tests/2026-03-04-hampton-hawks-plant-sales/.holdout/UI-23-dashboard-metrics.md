---
scenario_id: "UI-23"
title: "Dashboard Metrics"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Dashboard page renders metric cards for total orders, fulfilled orders, and revenue, and that no console errors occur.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least some orders and fulfillment data exist in the database to generate metrics.

## Steps

1. Navigate to `http://localhost:5173/dashboard`.
2. Wait for the page to fully load and metric cards to render.
3. Verify a "Total Orders" metric card is visible and displays a numeric value.
4. Verify a "Fulfilled" or "Fulfilled Orders" metric card is visible and displays a numeric value.
5. Verify a "Revenue" metric card is visible and displays a formatted currency value.
6. Verify the numeric values are reasonable (non-negative, not NaN or undefined).
7. Open the browser console and verify no errors are present.

## Expected Results

- The dashboard renders three metric cards: Total Orders, Fulfilled, and Revenue.
- Each card displays a valid numeric or currency value.
- No console errors are logged during page load or rendering.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** All three metric cards render with valid values and no console errors are present.
- **Fail:** Any metric card is missing, displays invalid data, or console errors are logged.
