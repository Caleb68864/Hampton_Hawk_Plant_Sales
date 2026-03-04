---
scenario_id: "UI-08"
title: "Sellers List A-Z Tabs"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Sellers list page renders with alphabetical A-Z letter tabs for filtering, a working search bar, and a "New Seller" button that navigates to the correct page.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- Sellers exist in the database with names starting with various letters.

## Steps

1. Navigate to `http://localhost:5173/sellers`.
2. Wait for the page to fully load and the sellers list to render.
3. Verify the A-Z letter tabs are visible on the page.
4. Click a letter tab (e.g., "A").
5. Wait for the seller list to update.
6. Verify that displayed sellers have names starting with the selected letter.
7. Click a different letter tab (e.g., "M").
8. Verify the list updates to show sellers starting with "M".
9. Locate the search bar input.
10. Type a partial seller name into the search bar.
11. Verify the results update to show matching sellers.
12. Clear the search bar.
13. Verify the list is restored.
14. Locate the "New Seller" button.
15. Click the "New Seller" button.
16. Verify the browser navigates to the seller creation page (e.g., `/sellers/new`).

## Expected Results

- A-Z letter tabs are rendered and clicking them filters the list by the selected letter.
- The search bar filters sellers by name.
- The "New Seller" button is visible and navigates to the correct creation page.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Letter tabs filter correctly, search bar works, "New Seller" button navigates to the creation page.
- **Fail:** Letter tabs do not filter, search does not work, "New Seller" button is missing or navigates incorrectly, or console errors occur.
