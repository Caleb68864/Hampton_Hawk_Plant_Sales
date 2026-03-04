---
scenario_id: "UI-03"
title: "New Order Create Flow"
tool: "playwright"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - ui
---

## Description

Verify the complete new order creation flow: searching and selecting a customer, searching and selecting a seller, adding a plant line with quantity, submitting the order, and confirming the redirect to the order detail page.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one customer exists in the database with a known name.
- At least one seller exists in the database with a known name.
- At least one active plant exists in the database with available inventory.

## Steps

1. Navigate to `http://localhost:5173/orders/new`.
2. Wait for the new order form to fully load.
3. Locate the customer search/select field.
4. Type a known customer name (e.g., "Johnson") into the customer search field.
5. Wait for the dropdown results to appear.
6. Click on the matching customer from the dropdown to select them.
7. Verify the customer field displays the selected customer name.
8. Locate the seller search/select field.
9. Type a known seller name (e.g., "Williams") into the seller search field.
10. Wait for the dropdown results to appear.
11. Click on the matching seller from the dropdown to select them.
12. Verify the seller field displays the selected seller name.
13. Locate the plant line section.
14. Search for or select a plant to add to the order.
15. Set the quantity to 3 for the selected plant line.
16. Verify the plant line appears in the order with the correct plant name and quantity.
17. Click the "Create Order" button.
18. Wait for the page to redirect.
19. Verify the browser URL has changed to `/orders/{newOrderId}` (order detail page).
20. Verify the order detail page displays the customer name, seller name, and the plant line just added.

## Expected Results

- Customer search returns matching results and selection populates the field.
- Seller search returns matching results and selection populates the field.
- A plant line can be added with a specified quantity.
- Clicking "Create Order" successfully creates the order via the API.
- The page redirects to the new order's detail page.
- The order detail page reflects the customer, seller, and line items from the creation form.
- No console errors or API errors occur during the flow.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** The entire flow from customer selection through order creation completes, the redirect lands on the correct order detail page, and all entered data is reflected.
- **Fail:** Any step fails to complete (dropdown does not appear, selection does not register, creation fails, redirect does not occur, or data does not match).
