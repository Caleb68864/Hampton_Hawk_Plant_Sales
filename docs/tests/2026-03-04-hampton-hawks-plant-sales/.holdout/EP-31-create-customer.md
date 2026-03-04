---
scenario_id: "EP-31"
title: "Create Customer"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - customers
---

## Description

Verify that `POST /api/customers` creates a new customer record with all provided fields persisted correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Customer` entity and related services are registered in the DI container.
- No pre-existing customer records exist in the database.

## Steps

1. **Send create request:** `POST /api/customers` with body:
   ```json
   {
     "displayName": "Charlie Brown",
     "firstName": "Charlie",
     "lastName": "Brown",
     "phone": "555-0301",
     "email": "charlie.brown@example.com",
     "notes": "Repeat buyer, prefers roses"
   }
   ```

2. **Verify creation response:** Assert `success: true` and the `data` contains:
   - `displayName` is `"Charlie Brown"`
   - `firstName` is `"Charlie"`
   - `lastName` is `"Brown"`
   - `phone` is `"555-0301"`
   - `email` is `"charlie.brown@example.com"`
   - `notes` is `"Repeat buyer, prefers roses"`
   - `id` is a valid non-default identifier
   - `createdAt` is set to a recent timestamp

3. **Verify persistence:** Send `GET /api/customers/{id}` using the returned ID. Confirm all fields match the create request.

4. **Verify listing:** Send `GET /api/customers` and confirm the newly created customer appears in the results.

## Expected Results

- `POST /api/customers` returns `ApiResponse<T>` with `success: true` and the full customer record in `data`.
- All fields (`displayName`, `firstName`, `lastName`, `phone`, `email`, `notes`) are persisted and retrievable.
- The customer appears in subsequent list queries.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP31"
```

## Pass/Fail Criteria

- **Pass:** Customer is created with all fields correct, is retrievable by ID, and appears in list queries.
- **Fail:** Creation fails, any field is missing or incorrect, or the customer is not retrievable after creation.
