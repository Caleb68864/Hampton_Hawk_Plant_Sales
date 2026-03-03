---
scenario_id: "EP-09"
title: "Response envelope format"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EP-09: Response envelope format

## Description
Verifies that every API response -- success or error -- is wrapped in the standard `{ success, data, errors }` envelope. Ensures clients can rely on a consistent response shape regardless of status code.

## Preconditions
- API is running at http://localhost:8080
- No specific database state required

## Steps
1. Call `GET /api/version` and capture the response body.
2. Verify the response body contains top-level fields `success`, `data`, and `errors`.
3. Verify `success` is `true` and `data` is not null.
4. Call `GET /api/nonexistent-endpoint-xyz` (a route that does not exist).
5. Verify the response status is 404.
6. Verify the 404 response body contains `success`, `data`, and `errors` fields.
7. Verify `success` is `false` and `errors` is a non-empty array.
8. Call `POST /api/plants` with a completely empty JSON body `{}`.
9. Verify the response status is 400.
10. Verify the 400 response body contains `success`, `data`, and `errors` fields.
11. Verify `success` is `false` and `errors` is a non-empty array containing at least one validation message.

## Expected Results
- `GET /api/version` returns HTTP 200 with `{ "success": true, "data": { ... }, "errors": [] }`.
- `GET /api/nonexistent-endpoint-xyz` returns HTTP 404 with `{ "success": false, "data": null, "errors": ["..."] }`.
- `POST /api/plants` with empty body returns HTTP 400 with `{ "success": false, "data": null, "errors": ["..."] }` where `errors` contains at least one validation message.
- All three responses contain exactly the three envelope fields at the top level (`success`, `data`, `errors`).

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** All three responses contain `success`, `data`, and `errors` at the top level; the success/error states and HTTP status codes match the expected results above.
- **Fail:** Any response is missing one or more envelope fields, or `success` / `errors` values do not reflect the actual outcome of the request.
