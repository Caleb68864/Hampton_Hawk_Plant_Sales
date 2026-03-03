---
scenario_id: "EP-12"
title: "Settings and SaleClosed toggle"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario EP-12: Settings and SaleClosed toggle

## Description
Verifies that the `SaleClosed` setting can be toggled via the settings endpoint, that toggling requires a valid admin PIN, and that the `SaleClosedAt` timestamp is set when the sale is closed. Steps must run in order due to state mutations.

## Preconditions
- API is running at http://localhost:8080
- Admin PIN is `1234`
- Sale is currently open (`SaleClosed=false`) -- reset if needed before running

## Steps
1. Call `GET /api/settings` and verify `SaleClosed` is `false`.
2. Attempt `PUT /api/settings/sale-closed` WITHOUT the `X-Admin-Pin` header (no auth).
3. Verify the response returns HTTP 403 and `success: false`.
4. Attempt `PUT /api/settings/sale-closed` with an incorrect PIN (`X-Admin-Pin: 9999`).
5. Verify the response returns HTTP 403 and `success: false`.
6. Call `PUT /api/settings/sale-closed` with headers `X-Admin-Pin: 1234` and `X-Admin-Reason: EP-12 test` and a body that sets `saleClosed: true` (or the appropriate field name).
7. Verify the response returns HTTP 200 and `success: true`.
8. Call `GET /api/settings` and verify `SaleClosed` is now `true`.
9. Verify `SaleClosedAt` is a non-null, valid ISO 8601 datetime.
10. Call `PUT /api/settings/sale-closed` again with the admin PIN, setting `saleClosed: false` to re-open the sale.
11. Verify the response returns HTTP 200 and `success: true`.
12. Call `GET /api/settings` and verify `SaleClosed` is `false` and `SaleClosedAt` is null or cleared.

## Expected Results
- `GET /api/settings` initially shows `SaleClosed: false`.
- `PUT /api/settings/sale-closed` without a valid PIN returns HTTP 403.
- `PUT /api/settings/sale-closed` with PIN `1234` successfully toggles `SaleClosed` to `true` and sets `SaleClosedAt`.
- After reopening, `SaleClosed` returns to `false`.

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** Missing or wrong PIN returns 403; correct PIN toggles `SaleClosed` and sets/clears `SaleClosedAt` correctly.
- **Fail:** An unauthenticated request succeeds, the toggle does not take effect, or `SaleClosedAt` is not set when sale is closed.
