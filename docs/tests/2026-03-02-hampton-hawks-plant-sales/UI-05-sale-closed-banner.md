---
scenario_id: "UI-05"
title: "Red SALE CLOSED banner appears on dashboard when sale is closed"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario UI-05: Red SALE CLOSED banner appears on dashboard when sale is closed

## Description
Verifies that when an admin closes the sale via API, a prominent red "SALE CLOSED" banner becomes visible at the top of the dashboard, and that reopening the sale removes the banner.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)
- Sale must be open (not closed) at test start -- verify via GET /api/settings

## Steps
1. Via API: PUT /api/settings/sale-closed with headers `X-Admin-Pin: 1234`, `X-Admin-Reason: "UI test close"`, and body `{ "isClosed": true }` (or equivalent).
2. Assert the API response is 200 and `success: true`.
3. Navigate to http://localhost:3000 (or reload if already on the page).
4. Wait for the page to fully load.
5. Assert that a red banner element containing the text "SALE CLOSED" is visible at the top of the page.
6. Verify the banner is styled in red (check background color or CSS class if possible).
7. Via API: PUT /api/settings/sale-closed with headers `X-Admin-Pin: 1234`, `X-Admin-Reason: "UI test reopen"`, and body `{ "isClosed": false }`.
8. Assert the reopen API response is 200 and `success: true`.

## Expected Results
- Step 5: "SALE CLOSED" text is visible in a red banner at the top of the dashboard.
- Step 6: The banner uses red coloring (not just text, but a visually prominent red element).
- After step 7 (teardown): The sale is returned to open state.

## Execution Tool
playwright -- use `page.goto`, `page.getByText('SALE CLOSED')`, `expect(locator).toBeVisible()`, and optionally `locator.evaluate` to check computed styles for red color.

## Pass / Fail Criteria
- **Pass:** A red "SALE CLOSED" banner is visible on the dashboard after closing the sale via API.
- **Fail:** No banner appears, the banner is not red, or the banner does not contain "SALE CLOSED" text.
