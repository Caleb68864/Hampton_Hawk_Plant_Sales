---
scenario_id: "DB-02"
title: "Soft-deleted customer is excluded from default list and included when requested"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario DB-02: Soft-deleted customer is excluded from default list and included when requested

## Description
Verifies that soft-deleting a customer removes it from the standard customer listing but makes it retrievable via the includeDeleted query parameter, confirming the soft-delete pattern is implemented correctly.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080

## Steps
1. Create a customer via POST /api/customers with a unique name (e.g., `firstName: "DeleteTest"`, `lastName: "SoftDelete"`).
2. Note the customer ID from the response.
3. Confirm the customer appears in GET /api/customers by searching for the unique name or scrolling results.
4. Delete the customer via DELETE /api/customers/{id}.
5. Assert the DELETE response status is 200 (or 204) and `success: true`.
6. GET /api/customers (no extra parameters) and verify the deleted customer is NOT present in the results.
7. GET /api/customers?includeDeleted=true and verify the deleted customer IS present in the results with a non-null `deletedAt` timestamp (or equivalent soft-delete indicator).

## Expected Results
- Step 4 returns HTTP 200 or 204.
- Step 6 confirms the customer is absent from the default listing.
- Step 7 confirms the customer is present when includeDeleted=true is passed, with a `deletedAt` value indicating when the deletion occurred.

## Execution Tool
bash -- use curl for all requests; use jq to filter results arrays and assert presence or absence of the customer ID.

## Pass / Fail Criteria
- **Pass:** Deleted customer does not appear in the default list but does appear with `includeDeleted=true`, and has a non-null `deletedAt` timestamp.
- **Fail:** Deleted customer still appears in the default list, is not retrievable with includeDeleted=true, or is permanently deleted (no record exists at all).
