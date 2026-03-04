---
scenario_id: "UI-06"
title: "Plants List Search"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Plants list page renders correctly, supports text-based search filtering, displays pagination controls, and provides a "New Plant" button.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least 10 plants exist in the database, including one or more with "Rose" in the name.

## Steps

1. Navigate to `http://localhost:5173/plants`.
2. Wait for the page to fully load and the plants list to render.
3. Verify the plants list/table is visible with plant data.
4. Locate the search bar input.
5. Type "Rose" into the search bar.
6. Wait for the list to update.
7. Verify all displayed plants contain "Rose" in their name.
8. Verify that plants without "Rose" in their name are not shown.
9. Clear the search bar.
10. Verify the full unfiltered list is restored.
11. Verify pagination controls are visible at the bottom of the list.
12. Locate the "New Plant" button on the page.
13. Verify the "New Plant" button is visible and clickable.
14. Click the "New Plant" button.
15. Verify navigation occurs (URL changes to the new plant creation page).

## Expected Results

- The plants list renders with plant data displayed.
- Typing "Rose" in the search bar filters the list to show only plants matching "Rose".
- Clearing the search restores the full list.
- Pagination controls are present and visible.
- The "New Plant" button is visible and navigates to the plant creation page when clicked.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Search filtering works for "Rose", pagination controls are visible, "New Plant" button navigates correctly.
- **Fail:** Search does not filter, pagination controls are missing, "New Plant" button is absent or does not navigate, or console errors occur.
