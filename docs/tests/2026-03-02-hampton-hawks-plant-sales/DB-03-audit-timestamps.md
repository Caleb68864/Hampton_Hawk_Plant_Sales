---
scenario_id: "DB-03"
title: "Audit timestamps: CreatedAt unchanged on update, UpdatedAt advances"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario DB-03: Audit timestamps: CreatedAt unchanged on update, UpdatedAt advances

## Description
Verifies that a plant's CreatedAt timestamp is set on creation and never changes, while UpdatedAt is set on creation and advances each time the record is updated.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a plant via POST /api/plants with a name and inventory value.
2. GET /api/plants/{id} and record the `createdAt` and `updatedAt` values from the response.
3. Confirm both timestamps are non-null ISO 8601 datetime strings.
4. Wait at least 1 second to ensure a measurable time difference (use `sleep 1` in bash).
5. Update the plant via PUT /api/plants/{id} (or PATCH) changing at least one field (e.g., update the name or inventory).
6. Assert the update response returns HTTP 200 and `success: true`.
7. GET /api/plants/{id} and record the new `createdAt` and `updatedAt` values.
8. Assert that `createdAt` in step 7 is identical to `createdAt` from step 2 (unchanged).
9. Assert that `updatedAt` in step 7 is strictly later than `updatedAt` from step 2 (advanced).

## Expected Results
- Step 2 shows both `createdAt` and `updatedAt` are set and non-null after creation.
- Step 8 confirms `createdAt` is bitwise identical before and after the update.
- Step 9 confirms `updatedAt` has a later timestamp than the value recorded in step 2.

## Execution Tool
bash -- use curl for all requests; use jq to extract timestamp fields and compare them as strings or use date parsing to verify ordering.

## Pass / Fail Criteria
- **Pass:** `createdAt` is unchanged after an update and `updatedAt` is strictly greater than its pre-update value.
- **Fail:** `createdAt` changes after an update, `updatedAt` does not advance, or either timestamp is null.
