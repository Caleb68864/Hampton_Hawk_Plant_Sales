---
scenario_id: "UI-02"
title: "Order Detail Page"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Order detail page displays the order header with status chip, customer name, and seller name, renders the OrderLinesTable with plant name, quantity ordered, and quantity fulfilled, and shows the appropriate action buttons.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one order exists with a known ID that has one or more order lines with partial fulfillment.
- The order has an associated customer and seller.

## Steps

1. Navigate to `http://localhost:5173/orders/{id}` where `{id}` is a known order ID.
2. Wait for the page to fully load.
3. Verify the order header section is visible.
4. Verify a status chip/badge is displayed (e.g., "Pending", "Fulfilled", or "Complete").
5. Verify the customer name is displayed in the header area.
6. Verify the seller name is displayed in the header area.
7. Locate the OrderLinesTable on the page.
8. Verify the table contains columns for plant name, quantity ordered, and quantity fulfilled.
9. Verify at least one row of order line data is displayed.
10. Verify action buttons are visible on the page (e.g., "Force Complete", "Cancel Order", or other relevant actions depending on order status).

## Expected Results

- The order header renders with a colored status chip showing the current order status.
- The customer name and seller name are both clearly displayed.
- The OrderLinesTable renders with plant name, qty ordered, and qty fulfilled columns.
- Each order line row contains valid data.
- Action buttons appropriate to the order status are visible and enabled.
- No console errors are present.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Header displays status chip, customer, and seller. OrderLinesTable shows plant, qty ordered, qty fulfilled. Action buttons are visible.
- **Fail:** Any header element is missing, the OrderLinesTable does not render or is missing columns, action buttons are absent, or console errors occur.
