---
scenario_id: "UI-01"
title: "Orders List Page"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Orders list page renders correctly with the expected table columns, supports text-based search filtering, and provides working pagination controls.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least 25 orders exist in the database to exercise pagination.
- Orders span multiple statuses (Pending, Fulfilled, Complete) and multiple customers/sellers.

## Steps

1. Navigate to `http://localhost:5173/orders`.
2. Wait for the page to fully load and the orders table to render.
3. Verify the table header contains columns: **Order#**, **Customer**, **Seller**, **Status**, **Items**.
4. Verify at least one row of data is displayed in the table.
5. Locate the search bar input at the top of the page.
6. Type a known customer name (e.g., "Smith") into the search bar.
7. Wait for the table to update (debounce may apply).
8. Verify that all visible rows contain "Smith" in the Customer column.
9. Clear the search bar.
10. Verify the full unfiltered list is restored.
11. Locate the pagination controls at the bottom of the table.
12. Click the "Next" page button (or page 2).
13. Verify the table content changes to a different set of orders.
14. Click the "Previous" page button (or page 1).
15. Verify the table returns to the original first page of results.

## Expected Results

- The orders table renders with all five expected columns: Order#, Customer, Seller, Status, Items.
- Each row displays valid data in every column.
- Typing in the search bar filters the table to show only matching orders.
- Clearing the search restores the full list.
- Pagination controls are visible and functional; clicking next/previous loads different pages of data.
- No console errors are present during any of these interactions.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** All five columns render, search filtering narrows results correctly, pagination changes displayed rows without errors.
- **Fail:** Any column is missing, search does not filter, pagination is broken or produces errors, or console errors are logged.
