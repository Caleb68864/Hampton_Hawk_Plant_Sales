---
scenario_id: "SR-04"
title: "Admin PIN validation across all scenarios"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - admin-pin
---

# Scenario SR-04: Admin PIN validation across all scenarios

## Description

Verifies that the `AdminPinActionFilter` correctly validates the `X-Admin-Pin` and `X-Admin-Reason` headers on endpoints decorated with `[RequiresAdminPin]`. Tests cover: missing headers, wrong PIN, valid PIN without reason on mutating requests, valid PIN with reason on mutating requests, and valid PIN without reason on GET requests (allowed).

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `AdminPinActionFilter` is registered as a global or scoped filter.
- The admin PIN is configured (e.g., `APP_ADMIN_PIN=1234` or `AdminPin: "1234"` in configuration).
- At least one `[RequiresAdminPin]` GET endpoint exists (`GET /api/admin-actions`).
- At least one `[RequiresAdminPin]` mutating endpoint exists (`PUT /api/settings/sale-closed`, `POST /api/orders/{id}/force-complete`).

## Steps

### Missing headers entirely

1. **Call without any admin headers:** `GET /api/admin-actions`
   - No `X-Admin-Pin` header, no `X-Admin-Reason` header.
   - Assert HTTP 403.
   - Assert response: `{ success: false, errors: ["Invalid or missing admin PIN."] }`.

### Wrong PIN

2. **Call with wrong PIN:** `GET /api/admin-actions`
   - Headers: `X-Admin-Pin: wrong-pin`
   - Assert HTTP 403.
   - Assert response: `{ success: false, errors: ["Invalid or missing admin PIN."] }`.

### Valid PIN, no reason on POST (mutating)

3. **Call mutating endpoint without reason:** `PUT /api/settings/sale-closed`
   - Headers: `X-Admin-Pin: <valid_pin>` (no `X-Admin-Reason`)
   - Body: `{ "saleClosed": true }`
   - Assert HTTP 403.
   - Assert response: `{ success: false, errors: ["Reason is required."] }`.

### Valid PIN + reason on POST (mutating) -- success

4. **Call mutating endpoint with PIN and reason:** `PUT /api/settings/sale-closed`
   - Headers: `X-Admin-Pin: <valid_pin>`, `X-Admin-Reason: "Test reason"`
   - Body: `{ "saleClosed": false }`
   - Assert HTTP 200.
   - Assert response: `{ success: true, data: { ... }, errors: [] }`.

### Valid PIN, no reason on GET -- success

5. **Call GET endpoint with PIN only:** `GET /api/admin-actions`
   - Headers: `X-Admin-Pin: <valid_pin>` (no `X-Admin-Reason`)
   - Assert HTTP 200 (GET does not require reason).
   - Assert response: `{ success: true, data: [...], errors: [] }`.

### Valid PIN + reason on GET -- also success

6. **Call GET endpoint with PIN and reason:** `GET /api/admin-actions`
   - Headers: `X-Admin-Pin: <valid_pin>`, `X-Admin-Reason: "Audit check"`
   - Assert HTTP 200.

## Expected Results

- No headers: HTTP 403, "Invalid or missing admin PIN."
- Wrong PIN: HTTP 403, "Invalid or missing admin PIN."
- Valid PIN, no reason on POST/PUT: HTTP 403, "Reason is required."
- Valid PIN + reason on POST/PUT: HTTP 200, success.
- Valid PIN, no reason on GET: HTTP 200, success (GET does not require reason).
- The filter distinguishes between mutating (POST, PUT, PATCH, DELETE) and read (GET) requests for the reason requirement.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR04"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- correct HTTP status codes for each header combination, reason required only for mutating requests, GET allowed without reason.
- **Fail:** Any assertion fails -- wrong status code, reason not enforced on mutating requests, or GET incorrectly blocked.
