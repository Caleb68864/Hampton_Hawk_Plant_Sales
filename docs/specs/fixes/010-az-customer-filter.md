---
title: "Fix: A-Z Customer Filter Broken"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: medium
failing_scenarios: [UI-03]
tags:
  - fix
  - ui
  - medium
---

# Fix: A-Z Customer Filter Broken

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: MEDIUM
- Failing Scenarios: UI-03

## Outcome
Clicking a letter tab (A-Z) on the customers page filters the displayed list to only customers whose last name starts with that letter. Clicking "All" shows all customers.

## Context
The A-Z tab filter on `/customers` shows "No customers found" when any letter tab is selected, even though matching customers exist in the database. The filter is either not passing the letter to the API correctly, the API is not filtering by last name initial, or the frontend is filtering locally with incorrect logic.

## Requirements
- Clicking "A" tab shows only customers with last name starting with "A"
- Clicking any letter tab correctly filters to that initial
- "All" tab (or equivalent) removes the filter and shows all customers
- The filter works with the API's pagination (first page of filtered results)

## Sub-Specs

### 1. Debug and Fix A-Z Filter
**Scope:** Investigate whether the bug is in the frontend (incorrect query param, local filter logic) or backend (API not supporting letter filter). Fix accordingly.
**Files likely touched:**
- `web/src/pages/CustomersPage.tsx` (or equivalent customers list page)
- `web/src/api/customers.ts` (API client)
- Possibly `api/src/HamptonHawksPlantSales.Api/Controllers/CustomersController.cs` if the backend filter is missing
- Possibly `api/src/HamptonHawksPlantSales.Infrastructure/Services/CustomerService.cs`
**Acceptance criteria:**
- Click "A" tab -> only A-initial customers shown
- Click "B" tab -> only B-initial customers shown
- Click "All" -> all customers shown
- Works with existing pagination
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario UI-03`
