---
scenario_id: "UI-07"
title: "Powered by Logic NE footer persists across multiple pages"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-07: Powered by Logic NE footer persists across multiple pages

## Description
Verifies that the "Powered by Logic NE" footer text is present and visible on the main dashboard as well as on the plants and orders pages, confirming the footer is a persistent layout element.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080

## Steps
1. Navigate to http://localhost:3000.
2. Wait for the page to fully load.
3. Scroll to the bottom of the page if necessary.
4. Assert that an element containing the text "Powered by Logic NE" is visible on the dashboard.
5. Navigate to http://localhost:3000/plants.
6. Wait for the page to fully load.
7. Scroll to the bottom of the page if necessary.
8. Assert that an element containing the text "Powered by Logic NE" is visible on the plants page.
9. Navigate to http://localhost:3000/orders.
10. Wait for the page to fully load.
11. Scroll to the bottom of the page if necessary.
12. Assert that an element containing the text "Powered by Logic NE" is visible on the orders page.

## Expected Results
- Step 4: "Powered by Logic NE" is visible on the dashboard (/).
- Step 8: "Powered by Logic NE" is visible on the plants page (/plants).
- Step 12: "Powered by Logic NE" is visible on the orders page (/orders).

## Execution Tool
playwright -- use `page.goto`, `page.waitForLoadState`, `page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))`, and `expect(page.getByText('Powered by Logic NE')).toBeVisible()` for each page.

## Pass / Fail Criteria
- **Pass:** "Powered by Logic NE" footer text is visible on all three pages: /, /plants, and /orders.
- **Fail:** The footer text is absent or not visible on any one of the three pages.
