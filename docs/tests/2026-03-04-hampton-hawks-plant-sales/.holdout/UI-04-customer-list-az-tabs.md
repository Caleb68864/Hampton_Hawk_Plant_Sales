---
scenario_id: "UI-04"
title: "Customer List A-Z Tabs"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Customers list page renders with alphabetical A-Z tabs for filtering by last name initial, and that the search bar filters results with debounce behavior.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- Customers exist in the database with last names starting with various letters, including at least one customer whose last name starts with "S".

## Steps

1. Navigate to `http://localhost:5173/customers`.
2. Wait for the page to fully load and the customer list to render.
3. Verify the A-Z letter tabs are visible on the page.
4. Click the "S" tab.
5. Wait for the customer list to update.
6. Verify that all displayed customers have last names starting with "S".
7. Verify that no customers with last names starting with other letters are shown.
8. Locate the search bar input.
9. Type a partial customer name (e.g., "Smi") into the search bar.
10. Wait approximately 300-500ms for the debounce to trigger.
11. Verify the results update to show only customers matching "Smi".
12. Type an additional character (e.g., "Smith") to further narrow results.
13. Wait for the debounce to trigger again.
14. Verify the results update to reflect the more specific search.
15. Clear the search bar.
16. Verify the full list for the selected letter tab is restored.

## Expected Results

- A-Z letter tabs are rendered and clickable.
- Clicking "S" filters the list to show only customers with last names starting with "S".
- The search bar accepts text input and filters results after a debounce delay.
- Typing additional characters further narrows the results.
- Clearing the search bar restores the full list for the active letter tab.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Letter tabs filter correctly by last name initial, search bar filters with debounce, and clearing search restores the tab-filtered list.
- **Fail:** Letter tabs do not filter, search does not apply debounce, results are incorrect, or console errors occur.
