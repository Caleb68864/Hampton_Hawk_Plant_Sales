---
scenario_id: "EP-54"
title: "Get API version"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - version
---

# Scenario EP-54: Get API version

## Description

Verifies that `GET /api/version` returns the current API version string wrapped in the standard `ApiResponse<T>` envelope. No authentication is required.

## Preconditions

- The `VersionController` is registered and the API is running.
- No special configuration or database seeding is required.

## Steps

1. **Send request:** `GET /api/version`

2. **Assert response status:** HTTP 200 with `success: true`.

3. **Assert response envelope:** Response matches `ApiResponse<object>` shape:
   - `success` = true
   - `data` is an object containing a `version` property
   - `errors` is an empty list

4. **Assert version value:** `data.version` is a non-empty string (e.g., `"1.0.0"`).

5. **Verify no authentication required:** The request succeeds without any `X-Admin-Pin` or other authentication headers.

## Expected Results

- Response: `{ success: true, data: { version: "1.0.0" }, errors: [] }`
- The version string is non-empty.
- No authentication is required to access this endpoint.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP54"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- version string returned in correct envelope format, no authentication required.
- **Fail:** Any assertion fails -- missing version, wrong envelope shape, or unexpected authentication requirement.
