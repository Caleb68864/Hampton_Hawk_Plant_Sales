---
scenario_id: "EP-51"
title: "Get application settings"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - settings
---

# Scenario EP-51: Get application settings

## Description

Verifies that `GET /api/settings` returns the current application settings including the `saleClosed` status and `saleClosedAt` timestamp in the standard `ApiResponse<SettingsResponse>` envelope.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `ISettingsService` and all related services are registered in the DI container.
- An `AppSettings` record exists in the database with default values (`SaleClosed=false`, `SaleClosedAt=null`).

## Steps

1. **Seed test data:** Ensure an `AppSettings` record exists with `SaleClosed = false` and `SaleClosedAt = null`.

2. **Send request:** `GET /api/settings`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert SettingsResponse fields:**
   - `saleClosed` = false
   - `saleClosedAt` = null

5. **Verify response envelope shape:** Response has `success`, `data`, and `errors` fields. `errors` is an empty list.

6. **Update settings:** Set `SaleClosed = true` and `SaleClosedAt` to a known timestamp in the database.

7. **Send request again:** `GET /api/settings`

8. **Assert updated fields:**
   - `saleClosed` = true
   - `saleClosedAt` is a valid DateTimeOffset (not null)

## Expected Results

- Default state: `{ success: true, data: { saleClosed: false, saleClosedAt: null } }`
- After update: `{ success: true, data: { saleClosed: true, saleClosedAt: "<timestamp>" } }`
- Response always uses the standard `ApiResponse<T>` envelope.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP51"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- settings returned with correct default and updated values, response envelope is well-formed.
- **Fail:** Any assertion fails -- wrong setting values, missing fields, or malformed response envelope.
