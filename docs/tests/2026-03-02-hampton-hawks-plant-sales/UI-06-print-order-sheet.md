---
scenario_id: "UI-06"
title: "Print order sheet renders header, plant table, and Logic NE footer"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-06: Print order sheet renders header, plant table, and Logic NE footer

## Description
Verifies that the printable order sheet page renders all required elements: the application header, a table listing ordered plants with quantities, and the "Powered by Logic NE" footer.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080
- A test order with at least one order line must exist (create via API)

## Steps
1. Via API: Create a customer, create a plant with a known name, create an order for the customer, and add a line to the order for the plant.
2. Note the order ID from the API response.
3. Navigate to http://localhost:3000/print/order/{orderId}.
4. Wait for the page to fully render.
5. Assert that an element containing the text "Hampton Hawks Plant Sales" is visible (the header).
6. Assert that an element containing the text "Customer Order Sheet" is visible (the page subtitle or section heading).
7. Assert that a table element is present on the page.
8. Within the table, assert that the plant name created in step 1 is visible.
9. Within the table, assert that the quantity ordered for that plant is visible.
10. Assert that an element containing the text "Powered by Logic NE" is visible in the footer area.

## Expected Results
- Step 5: "Hampton Hawks Plant Sales" header text is visible.
- Step 6: "Customer Order Sheet" subtitle/heading is visible.
- Step 7-9: A table is rendered with the correct plant name and quantity.
- Step 10: "Powered by Logic NE" footer text is visible.

## Execution Tool
playwright -- use `page.goto`, `page.getByText`, `page.locator('table')`, and `expect(locator).toBeVisible()` for all assertions.

## Pass / Fail Criteria
- **Pass:** All five elements (application header, "Customer Order Sheet" heading, table with plant name and qty, footer text) are visible on the print page.
- **Fail:** Any of the five required elements is missing or not visible on the page.
