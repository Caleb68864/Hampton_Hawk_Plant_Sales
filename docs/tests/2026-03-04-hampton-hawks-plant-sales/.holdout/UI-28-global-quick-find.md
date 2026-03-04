---
scenario_id: "UI-28"
title: "Global Quick Find"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the global QuickFind overlay: it opens with a keyboard shortcut (Ctrl+K or /), accepts search input, displays results from multiple entity types, navigates to a detail page when a result is clicked, and closes when Escape is pressed.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- Data exists across multiple entity types (customers, orders, plants, sellers) so that search results span categories.

## Steps

1. Navigate to `http://localhost:5173/` (or any page in the application).
2. Wait for the page to fully load.
3. Press `Ctrl+K` (or `/` if that is the configured shortcut) on the keyboard.
4. Verify the QuickFindOverlay appears as a modal/overlay with a search input field.
5. Type a search term that matches multiple entity types (e.g., a name that appears in both customers and sellers, or a generic term).
6. Wait for results to appear.
7. Verify results are displayed, grouped or labeled by entity type (e.g., "Customers", "Orders", "Plants", "Sellers").
8. Verify at least two different entity types appear in the results.
9. Click on one of the search results.
10. Verify the browser navigates to the detail page for the selected entity (e.g., `/customers/{id}` or `/plants/{id}`).
11. Navigate back to any page.
12. Press `Ctrl+K` (or `/`) to reopen the QuickFindOverlay.
13. Verify the overlay opens again.
14. Press the `Escape` key.
15. Verify the QuickFindOverlay closes.
16. Verify the underlying page is still visible and functional.

## Expected Results

- The keyboard shortcut (Ctrl+K or /) opens the QuickFindOverlay.
- The overlay contains a search input that accepts text.
- Search results display matches from multiple entity types.
- Clicking a result navigates to the corresponding detail page.
- Pressing Escape closes the overlay without side effects.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Shortcut opens overlay, search returns multi-entity results, clicking a result navigates correctly, Escape closes the overlay.
- **Fail:** Shortcut does not open overlay, search returns no results or single-entity results only, navigation fails, Escape does not close, or errors occur.
