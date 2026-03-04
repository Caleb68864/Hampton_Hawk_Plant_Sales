---
scenario_id: "UI-25"
title: "Print Order Page"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the print order page renders order details, line items, and customer information in a print-friendly layout.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one order exists with a known ID, associated customer, and one or more line items.

## Steps

1. Navigate to `http://localhost:5173/print/orders/{orderId}` where `{orderId}` is a known order ID.
2. Wait for the page to fully load and the print layout to render.
3. Verify the order number or ID is displayed.
4. Verify the order status is displayed.
5. Verify the customer name is displayed.
6. Verify additional customer information is shown (e.g., phone, email).
7. Verify the line items table is rendered.
8. For each line item, verify the plant name and quantity are displayed.
9. Verify the page layout is print-friendly (clean layout, no navigation bars, appropriate sizing for paper output).
10. Verify no console errors are present.

## Expected Results

- The print order page renders with order details (number, status), customer information (name, contact details), and line items (plant names, quantities).
- The layout is optimized for printing.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Order details, customer info, and line items render correctly in a print-friendly layout with no console errors.
- **Fail:** Any section is missing (order details, customer info, line items), layout is not print-appropriate, or console errors occur.
