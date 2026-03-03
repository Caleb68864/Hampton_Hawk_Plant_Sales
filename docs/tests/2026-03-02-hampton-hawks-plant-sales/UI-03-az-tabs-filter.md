---
scenario_id: "UI-03"
title: "A-Z tabs on customers page filter list by last name initial"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-03: A-Z tabs on customers page filter list by last name initial

## Description
Verifies that the alphabetical tab controls on the customers page correctly filter the displayed customer list to only those whose last name starts with the selected letter, and that the "All" tab removes the filter.

## Preconditions
- Docker Compose running
- Web app available at http://localhost:3000
- API available at http://localhost:8080
- Customers with last names starting with A, B, and C must exist (create via API before running if not already present)

## Steps
1. Via API: Create a customer with `lastName: "Anderson"` (starts with A) if one does not exist.
2. Via API: Create a customer with `lastName: "Brown"` (starts with B) if one does not exist.
3. Via API: Create a customer with `lastName: "Carter"` (starts with C) if one does not exist.
4. Navigate to http://localhost:3000/customers.
5. Wait for the customer list to render.
6. Click the "A" tab in the A-Z filter bar.
7. Assert that only customers with a last name starting with "A" are shown in the list (e.g., "Anderson" is visible).
8. Assert that "Brown" and "Carter" are NOT visible in the filtered list.
9. Click the "B" tab.
10. Assert that only customers with a last name starting with "B" are shown (e.g., "Brown" is visible).
11. Assert that "Anderson" and "Carter" are NOT visible.
12. Click the "All" tab (or equivalent reset control).
13. Assert that "Anderson", "Brown", and "Carter" are all visible in the list.

## Expected Results
- After clicking "A": only A-initial customers are shown.
- After clicking "B": only B-initial customers are shown.
- After clicking "All": all customers including A, B, and C initials are shown.

## Execution Tool
playwright -- use `page.goto`, `page.getByRole('tab', { name: 'A' })`, `page.getByText`, and `expect(locator).toBeVisible()` / `expect(locator).not.toBeVisible()`.

## Pass / Fail Criteria
- **Pass:** Each letter tab shows only matching-initial customers and hides non-matching ones; the All tab shows all customers.
- **Fail:** A letter tab shows customers from other initials, hides all customers, or the All tab does not restore the full list.
