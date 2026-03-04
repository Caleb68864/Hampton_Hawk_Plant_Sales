---
scenario_id: "UI-12"
title: "Pickup Lookup Find Customer"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Pickup page allows searching for customers by name, displays matching customers with orders, supports A-Z letter tab filtering, and allows clicking a customer row to navigate to the scan page.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).
- At least one customer with an active order exists in the database.
- Customers exist with names spanning multiple letters of the alphabet.

## Steps

1. Navigate to `http://localhost:5173/pickup`.
2. Wait for the page to fully load.
3. Locate the search input field.
4. Type a known customer name (e.g., "Johnson") into the search field.
5. Wait for results to appear.
6. Verify that matching customers with orders are displayed in the results list.
7. Clear the search field.
8. Locate the A-Z letter tabs.
9. Click a letter tab (e.g., "J").
10. Verify the list filters to show only customers whose names start with "J".
11. Click a different letter tab to verify filtering updates.
12. Locate a customer row in the results list.
13. Click on the customer row.
14. Verify navigation occurs to the scan page (e.g., `/pickup/{orderId}`).

## Expected Results

- The search input filters customers by name and shows those with orders.
- A-Z letter tabs are visible and filter the customer list by first letter.
- Clicking a customer row navigates to the pickup scan page for that customer's order.
- No console errors occur.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** Search finds matching customers, A-Z tabs filter correctly, clicking a customer row navigates to the scan page.
- **Fail:** Search does not return results, A-Z tabs do not filter, clicking a row does not navigate, or console errors occur.
