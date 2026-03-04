---
scenario_id: "EP-52"
title: "Toggle sale closed with admin PIN"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - settings
  - admin
---

# Scenario EP-52: Toggle sale closed with admin PIN

## Description

Verifies that `PUT /api/settings/sale-closed` requires `X-Admin-Pin` and `X-Admin-Reason` headers, correctly toggles the `SaleClosed` flag, sets the `SaleClosedAt` timestamp, and logs an `AdminAction` record.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `ISettingsService`, `IAdminService`, and `AdminPinActionFilter` are registered in the DI container.
- An `AppSettings` record exists with `SaleClosed = false`.
- The admin PIN is configured (e.g., `APP_ADMIN_PIN` environment variable or `AdminPin` in configuration).

## Steps

1. **Seed test data:** Ensure `AppSettings` has `SaleClosed = false` and `SaleClosedAt = null`.

2. **Send request to close sale:** `PUT /api/settings/sale-closed`
   - Headers: `X-Admin-Pin: <valid_pin>`, `X-Admin-Reason: "Closing sale for the day"`
   - Body: `{ "saleClosed": true, "reason": "Closing sale for the day" }`

3. **Assert response status:** HTTP 200 with `success: true`.

4. **Assert SettingsResponse:**
   - `saleClosed` = true
   - `saleClosedAt` is a valid DateTimeOffset (not null), close to the current time

5. **Verify AdminAction logged:** Query the `AdminAction` table. Confirm a record exists with:
   - `actionType` indicating a sale-closed toggle
   - `entityType` = `"Settings"` (or equivalent)
   - `reason` = `"Closing sale for the day"`

6. **Send request to reopen sale:** `PUT /api/settings/sale-closed`
   - Headers: `X-Admin-Pin: <valid_pin>`, `X-Admin-Reason: "Reopening sale"`
   - Body: `{ "saleClosed": false, "reason": "Reopening sale" }`

7. **Assert response status:** HTTP 200 with `success: true`.

8. **Assert SettingsResponse:**
   - `saleClosed` = false

9. **Verify without admin PIN:** Send `PUT /api/settings/sale-closed` without `X-Admin-Pin` header. Assert HTTP 403.

10. **Verify without reason:** Send `PUT /api/settings/sale-closed` with valid `X-Admin-Pin` but no `X-Admin-Reason`. Assert HTTP 403 (reason required for PUT).

## Expected Results

- Close: `{ success: true, data: { saleClosed: true, saleClosedAt: "<timestamp>" } }` and AdminAction logged.
- Reopen: `{ success: true, data: { saleClosed: false, ... } }`.
- Without PIN: HTTP 403 with `{ success: false, errors: ["Invalid or missing admin PIN."] }`.
- Without reason on PUT: HTTP 403 with `{ success: false, errors: ["Reason is required."] }`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP52"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- sale toggled correctly, timestamp set, AdminAction logged, PIN and reason enforcement works.
- **Fail:** Any assertion fails -- setting not toggled, AdminAction missing, PIN/reason validation bypassed, or incorrect response.
