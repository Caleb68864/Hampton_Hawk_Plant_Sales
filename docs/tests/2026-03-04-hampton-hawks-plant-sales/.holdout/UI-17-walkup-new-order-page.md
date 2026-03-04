---
scenario_id: "UI-17"
title: "Walk-Up New Order Page"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the Walk-Up new order flow: searching for or creating a customer inline, browsing plants with A-Z tabs, adding lines with quantities, and creating a walk-up order.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one active plant exists with available walk-up inventory.
- The sale is not closed.

## Steps

1. Navigate to `http://localhost:5173/walkup/new`.
2. Wait for the page to fully load.
3. Locate the customer search or creation section.
4. Option A -- Search for existing customer: Type a known customer name and select from results.
5. Option B -- Create inline: Fill in displayName (e.g., "Walk-Up Test Customer"), phone (e.g., "555-000-1111"), and email (e.g., "walkup@test.com") in the inline creation fields.
6. Verify the customer is selected or created.
7. Locate the plant browsing section with A-Z tabs.
8. Click a letter tab (e.g., "R") to filter plants.
9. Verify plants starting with "R" are displayed.
10. Locate a plant in the list and click to add it or click its "Add" button.
11. Set the quantity to 2 for the added plant line.
12. Verify the plant line appears in the order summary with the correct plant and quantity.
13. Click the "Create Walk-Up Order" button.
14. Wait for the order creation to process.
15. Verify success feedback appears or the page redirects to the created order.

## Expected Results

- Customer can be searched for or created inline.
- A-Z plant tabs filter the plant list correctly.
- Plants can be added to the order with a specified quantity.
- Clicking "Create Walk-Up Order" creates the order successfully.
- Success feedback is displayed or the user is redirected to the order detail.
- No console errors or API errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Customer selection/creation works, plant browsing and line addition works, order creation succeeds with confirmation.
- **Fail:** Customer cannot be selected or created, plants cannot be browsed or added, order creation fails, or errors occur.
