---
scenario_id: "UI-21"
title: "Station Home Navigation"
tool: "playwright"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - ui
---

## Description

Verify the Station home page renders four mode cards (Scan Pickups, Lookup & Print, Walk-Up Sales, Admin Tools) and that clicking each card navigates to the correct page.

## Preconditions

- The application is running at `http://localhost:5173` (web) and `http://localhost:5000` (API).

## Steps

1. Navigate to `http://localhost:5173/station`.
2. Wait for the page to fully load.
3. Verify four mode cards are visible on the page.
4. Verify the first card is labeled "Scan Pickups" (or similar).
5. Verify the second card is labeled "Lookup & Print" (or similar).
6. Verify the third card is labeled "Walk-Up Sales" (or similar).
7. Verify the fourth card is labeled "Admin Tools" (or similar).
8. Click the "Scan Pickups" card.
9. Verify the browser navigates to the pickup/scan page.
10. Navigate back to `http://localhost:5173/station`.
11. Click the "Lookup & Print" card.
12. Verify the browser navigates to the lookup/print page.
13. Navigate back to `http://localhost:5173/station`.
14. Click the "Walk-Up Sales" card.
15. Verify the browser navigates to the walk-up sales page.
16. Navigate back to `http://localhost:5173/station`.
17. Click the "Admin Tools" card.
18. Verify the browser navigates to the admin tools page.

## Expected Results

- Four mode cards are visible on the Station home page.
- Each card is correctly labeled.
- Clicking each card navigates to the appropriate page.
- No console errors occur during navigation.

## Execution Tool

Playwright

## Pass/Fail Criteria

- **Pass:** All four cards are visible with correct labels and each navigates to the correct destination page.
- **Fail:** Any card is missing, mislabeled, or navigates to the wrong page, or console errors occur.
