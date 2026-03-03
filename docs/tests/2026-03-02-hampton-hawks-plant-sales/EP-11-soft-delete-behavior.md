---
scenario_id: "EP-11"
title: "Soft delete behavior"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-11: Soft delete behavior

## Description
Verifies that deleting a plant record performs a soft delete (sets `DeletedAt`) rather than a hard delete, that soft-deleted records are excluded from default list responses, and that they can be retrieved when explicitly requested with `includeDeleted=true`.

## Preconditions
- API is running at http://localhost:8080
- No specific existing data required

## Steps
1. Create a new plant via `POST /api/plants` with a unique name (e.g. `Soft Delete Test Plant`). Record the returned `id`.
2. Call `GET /api/plants` and verify the new plant appears in the list.
3. Call `DELETE /api/plants/{id}` using the recorded `id`.
4. Verify the DELETE response returns HTTP 200 (or 204) and `success: true`.
5. Call `GET /api/plants` (default, no extra parameters).
6. Verify the deleted plant is NOT present in the response list.
7. Call `GET /api/plants?includeDeleted=true`.
8. Verify the deleted plant IS present in the response list.
9. Verify the deleted plant record has a non-null `deletedAt` (or `DeletedAt`) timestamp field.
10. Verify the `deletedAt` timestamp is a valid ISO 8601 datetime that is close to the current time.

## Expected Results
- After `DELETE /api/plants/{id}`, the record is not physically removed from the database.
- `GET /api/plants` (default) does not include the deleted plant.
- `GET /api/plants?includeDeleted=true` includes the deleted plant with a populated `deletedAt` timestamp.
- The `deletedAt` value is a valid datetime string set at the time of deletion.

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** Deleted plant is absent from the default list, present in the `includeDeleted=true` list, and carries a non-null `deletedAt` timestamp.
- **Fail:** Deleted plant still appears in the default list, is missing from `includeDeleted=true`, or `deletedAt` is null after deletion.
