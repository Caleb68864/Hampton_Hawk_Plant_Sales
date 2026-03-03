---
scenario_id: "UI-04"
title: "Quick-find overlay opens with Ctrl+K, shows results, and closes with Esc"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-04: Quick-find overlay opens with Ctrl+K, shows results, and closes with Esc

## Description
Verifies that the global quick-find overlay is triggered by the Ctrl+K keyboard shortcut, displays search results when text is typed, and closes cleanly when the Escape key is pressed.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080
- At least one searchable entity (customer, plant, or order) should exist to produce results

## Steps
1. Navigate to http://localhost:3000.
2. Wait for the page to fully load.
3. Assert the quick-find overlay is NOT currently visible.
4. Press Ctrl+K (keyboard shortcut).
5. Assert the quick-find overlay is now visible (e.g., a modal, dialog, or floating search input appears).
6. Type a search term that is expected to match existing data (e.g., a customer name or plant name).
7. Wait briefly for search results to appear (debounce delay expected).
8. Assert that at least one search result item is visible in the overlay.
9. Press the Escape key.
10. Assert the quick-find overlay is no longer visible (has been dismissed).

## Expected Results
- Step 3: Overlay is not visible on initial load.
- Step 5: Overlay becomes visible after Ctrl+K.
- Step 8: Search results are displayed after typing.
- Step 10: Overlay is dismissed after pressing Escape.

## Execution Tool
playwright -- use `page.keyboard.press('Control+K')`, `page.keyboard.type(...)`, `page.keyboard.press('Escape')`, and `expect(locator).toBeVisible()` / `expect(locator).not.toBeVisible()`.

## Pass / Fail Criteria
- **Pass:** Ctrl+K opens the overlay, typing yields results, and Escape closes the overlay.
- **Fail:** Ctrl+K does not open the overlay, no results appear after typing, or Escape does not close the overlay.
