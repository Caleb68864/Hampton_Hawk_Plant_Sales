---
scenario_id: "SR-19"
title: "Version endpoint returns 200 with version data"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
---

# Scenario SR-19: Version endpoint returns 200 with version data

## Description
Verifies that the /api/version endpoint is reachable and returns a 200 response containing version information about the running API.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080

## Steps
1. GET /api/version with no authentication headers.
2. Assert the HTTP response status is 200.
3. Assert the response Content-Type is application/json.
4. Parse the response body and verify it contains at least one version-related field (e.g., `version`, `buildDate`, `environment`, or similar).
5. Verify the response envelope follows the standard format `{ success: true, data: { ... } }`.

## Expected Results
- Step 1 returns HTTP 200.
- Response Content-Type includes `application/json`.
- Response body contains `{ success: true, data: { version: "...", ... } }` with at least one non-null version field.

## Execution Tool
bash -- use curl with `-i` to inspect headers and `-s` for silent mode; pipe to jq for JSON assertion.

## Pass / Fail Criteria
- **Pass:** GET /api/version returns 200 with a valid JSON body containing version data in the standard envelope.
- **Fail:** Non-200 status, non-JSON response, missing version data, or envelope does not include `success: true`.
