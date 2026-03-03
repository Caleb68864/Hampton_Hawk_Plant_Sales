---
scenario_id: "UI-01"
title: "Dashboard loads with header, metrics cards, and no console errors"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-01: Dashboard loads with header, metrics cards, and no console errors

## Description
Verifies that the main dashboard page renders the application header, metric summary cards, and produces no browser console errors on initial load.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080

## Steps
1. Open a Playwright browser page.
2. Begin capturing browser console messages (listen for console errors before navigation).
3. Navigate to http://localhost:3000.
4. Wait for the page to reach a stable loaded state (networkidle or DOMContentLoaded).
5. Assert that an element containing the text "Hampton Hawks Plant Sales" is visible on the page (the application header).
6. Assert that at least one dashboard metrics card element is visible (cards may show values of 0 if no data exists -- that is acceptable).
7. Review captured console messages and assert that no messages of level "error" were emitted.

## Expected Results
- The page title or header element contains "Hampton Hawks Plant Sales".
- One or more metrics/summary cards are rendered and visible.
- The browser console contains zero error-level messages.

## Execution Tool
playwright -- use `page.goto`, `page.waitForLoadState`, `page.getByText`, and `page.on('console', ...)` for console capture.

## Pass / Fail Criteria
- **Pass:** Header text is visible, at least one metrics card is rendered, and no console errors are present.
- **Fail:** Header is missing, no metrics cards render, or any console error is captured during load.
