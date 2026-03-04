---
scenario_id: "SR-03"
title: "All endpoints return ApiResponse envelope"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - response-envelope
---

# Scenario SR-03: All endpoints return ApiResponse envelope

## Description

Verifies that every API endpoint returns the standard `ApiResponse<T>` envelope with the shape `{ success, data, errors }`. This includes successful responses (success=true, data populated, errors empty), error responses (success=false, errors populated), and responses across different HTTP methods (GET, POST, DELETE).

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- All controllers and services are registered in the DI container.
- Seed data exists for plants, customers, sellers, and orders.

## Steps

### Successful responses

1. **GET plants:** `GET /api/plants`
   - Assert HTTP 200.
   - Assert response has `success` = true.
   - Assert response has `data` field (non-null).
   - Assert response has `errors` field (empty list).

2. **GET version:** `GET /api/version`
   - Assert HTTP 200.
   - Assert response shape: `{ success: true, data: { version: "..." }, errors: [] }`.

3. **GET settings:** `GET /api/settings`
   - Assert HTTP 200 with standard envelope.

4. **POST create order:** `POST /api/orders` with valid order data.
   - Assert HTTP 200 with `{ success: true, data: { ... }, errors: [] }`.

5. **DELETE customer:** `DELETE /api/customers/{id}` for an existing customer.
   - Assert HTTP 200 with `{ success: true, data: true, errors: [] }`.

### Error responses

6. **GET non-existent plant:** `GET /api/plants/{randomGuid}`
   - Assert HTTP 404.
   - Assert response has `success` = false.
   - Assert `errors` is a non-empty list containing an error message.

7. **POST invalid order:** `POST /api/orders` with invalid/empty body.
   - Assert HTTP 400.
   - Assert response has `success` = false.
   - Assert `errors` contains validation error messages.

8. **DELETE non-existent customer:** `DELETE /api/customers/{randomGuid}`
   - Assert HTTP 404 with `{ success: false, errors: ["Customer not found."] }`.

9. **Admin endpoint without PIN:** `GET /api/admin-actions` without `X-Admin-Pin`.
   - Assert HTTP 403 with `{ success: false, errors: ["Invalid or missing admin PIN."] }`.

### Verify envelope consistency

10. **For each response above:** Verify the JSON structure contains exactly three top-level keys: `success` (boolean), `data` (any type or null), `errors` (array of strings).

## Expected Results

- Every successful response: `{ success: true, data: <result>, errors: [] }`.
- Every error response: `{ success: false, data: null, errors: ["<message>", ...] }`.
- No endpoint returns a raw object without the envelope.
- The `data` field is always present (even if null on errors due to `JsonIgnore(Condition = JsonIgnoreCondition.Never)`).

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR03"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- every endpoint response matches the `{ success, data, errors }` shape for both success and error cases.
- **Fail:** Any assertion fails -- an endpoint returns a non-standard response shape, missing fields, or incorrect success/error values.
