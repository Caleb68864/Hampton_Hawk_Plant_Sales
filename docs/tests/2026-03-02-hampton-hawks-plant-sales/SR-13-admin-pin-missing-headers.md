---
scenario_id: "SR-13"
title: "Admin PIN missing or incorrect headers return 403"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-13: Admin PIN missing or incorrect headers return 403

## Description
Verifies that the sale-closed settings endpoint enforces all three header requirements: X-Admin-Pin must be present, must be correct, and X-Admin-Reason must also be present. Missing or wrong values each independently produce a 403.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080

## Steps
1. PUT /api/settings/sale-closed with no headers at all (no X-Admin-Pin, no X-Admin-Reason).
2. Assert the HTTP response status is 403.
3. PUT /api/settings/sale-closed with `X-Admin-Pin: 9999` (wrong PIN) and `X-Admin-Reason: "Test"`.
4. Assert the HTTP response status is 403.
5. PUT /api/settings/sale-closed with `X-Admin-Pin: 1234` (correct PIN) but NO X-Admin-Reason header.
6. Assert the HTTP response status is 403.
7. Confirm the sale-closed setting was not changed by any of the above requests via GET /api/settings (or equivalent).

## Expected Results
- Step 1 returns HTTP 403.
- Step 3 returns HTTP 403.
- Step 5 returns HTTP 403.
- Step 7 shows the sale-closed setting is in its original state (unchanged).
- All 403 responses include `{ success: false, errors: [...] }`.

## Execution Tool
bash -- use curl with `-o /dev/null -w "%{http_code}"` to capture and assert each status code.

## Pass / Fail Criteria
- **Pass:** All three requests return 403 and the sale-closed setting remains unchanged.
- **Fail:** Any of the three requests returns a non-403 status, or the setting is modified by a request that should have been rejected.
