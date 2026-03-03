---
scenario_id: "EP-10"
title: "Pagination enforcement"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-10: Pagination enforcement

## Description
Verifies that list endpoints respect `page` and `pageSize` query parameters, cap `pageSize` at the system maximum of 200, and include pagination metadata in every paginated response.

## Preconditions
- API is running at http://localhost:8080
- At least 30 plant records exist in the database (create them in the steps below if not present)

## Steps
1. Create 30 plant records via `POST /api/plants` in a loop, using unique names (e.g. `Test Plant 01` through `Test Plant 30`). Each body requires at minimum a `name` field.
2. Call `GET /api/plants?page=1&pageSize=10`.
3. Verify the response contains exactly 10 items in the `data` array (or the nested items array if paginated).
4. Verify the response metadata includes pagination fields such as `page`, `pageSize`, `totalCount`, and `totalPages` (or equivalent field names used by the API).
5. Verify `page` is `1` and `pageSize` is `10` in the metadata.
6. Call `GET /api/plants?page=1&pageSize=300`.
7. Verify the response returns at most 200 items (the system cap).
8. Verify the metadata `pageSize` reflects the capped value (200 or the actual number returned, not 300).
9. Call `GET /api/plants?page=2&pageSize=10`.
10. Verify the second page contains a different set of items than page 1.
11. Verify `page` is `2` in the metadata.

## Expected Results
- `GET /api/plants?page=1&pageSize=10` returns exactly 10 items with pagination metadata showing page=1, pageSize=10.
- `GET /api/plants?pageSize=300` returns no more than 200 items; the effective page size in metadata is capped at 200.
- `GET /api/plants?page=2&pageSize=10` returns a different set of 10 items and metadata shows page=2.
- All paginated responses include total count and total pages metadata.

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** Page 1 with pageSize=10 returns exactly 10 items; pageSize=300 is silently capped to 200; pagination metadata is present and accurate on all responses.
- **Fail:** Item counts do not match requested pageSize, the 300 cap is not enforced, or pagination metadata is missing from any response.
