---
scenario_id: "UI-02"
title: "Pickup scan workflow: scan barcode, green banner, decrement counter, undo"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario UI-02: Pickup scan workflow: scan barcode, green banner, decrement counter, undo

## Description
Verifies the full pickup scan workflow: setting up test data via API, finding a customer on the pickup screen, opening the scan interface, scanning a barcode, verifying UI feedback, and using the undo function.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Via API: Create a plant with a known barcode (e.g., `barcode: "SCAN-TEST-001"`) and sufficient inventory.
2. Via API: Create a customer with a searchable name (e.g., `firstName: "Pickup"`, `lastName: "Tester"`).
3. Via API: Create an order for that customer with at least one line for the plant created in step 1.
4. Open a Playwright browser page and navigate to http://localhost:3000/pickup.
5. Search for the customer by last name "Tester" using the customer search input.
6. Click on the matching customer or order entry to open the scan screen.
7. Verify the scan input (barcode input field) is focused automatically.
8. Note the "items remaining" counter value.
9. Type the barcode "SCAN-TEST-001" into the scan input and press Enter.
10. Verify a green success banner (or equivalent green feedback element) appears on screen.
11. Verify the "items remaining" counter has decremented by 1 from the value noted in step 8.
12. Click the "Undo" button (or equivalent undo control).
13. Verify the "items remaining" counter has returned to its value from step 8.

## Expected Results
- Step 7: The scan input field has focus without requiring manual click.
- Step 10: A green banner or success indicator is visible after the scan.
- Step 11: The counter decrements by exactly 1.
- Step 13: The counter returns to its original value after undo.

## Execution Tool
playwright -- use `page.goto`, `page.getByRole`, `page.keyboard.type`, `page.getByText`, and `expect(locator).toBeVisible()` for assertions.

## Pass / Fail Criteria
- **Pass:** Scan input is auto-focused, green banner appears after scan, counter decrements, and undo restores the counter.
- **Fail:** Scan input is not focused, no green banner appears, counter does not decrement, or undo does not restore the count.
