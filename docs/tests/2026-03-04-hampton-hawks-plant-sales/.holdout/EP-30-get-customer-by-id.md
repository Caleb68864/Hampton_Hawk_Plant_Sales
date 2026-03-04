---
scenario_id: "EP-30"
title: "Get Customer by ID"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - customers
---

## Description

Verify that `GET /api/customers/{id}` returns the full customer record with all fields populated when a valid ID is provided.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Customer` entity and related services are registered in the DI container.
- No pre-existing customer records exist in the database.

## Steps

1. **Seed test data:** Insert 1 customer into the database:
   - `{ displayName: "Alice Walker", firstName: "Alice", lastName: "Walker", phone: "555-0201", email: "alice.walker@example.com", notes: "VIP customer" }`

2. **Send request:** `GET /api/customers/{id}` using the seeded customer's ID.

3. **Verify all fields:** Assert the response contains:
   - `id` matches the seeded customer's ID
   - `displayName` is `"Alice Walker"`
   - `firstName` is `"Alice"`
   - `lastName` is `"Walker"`
   - `phone` is `"555-0201"`
   - `email` is `"alice.walker@example.com"`
   - `notes` is `"VIP customer"`
   - `createdAt` is a valid timestamp
   - `updatedAt` is a valid timestamp

4. **Verify not found:** Send `GET /api/customers/{nonExistentId}` with a random GUID/ID. Assert that the response indicates failure with `success: false`.

## Expected Results

- `GET /api/customers/{id}` returns `ApiResponse<T>` with `success: true` and `data` containing all customer fields with correct values.
- `GET /api/customers/{nonExistentId}` returns `ApiResponse<T>` with `success: false` and an appropriate error message.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP30"
```

## Pass/Fail Criteria

- **Pass:** All fields are present and match seeded values including `displayName`, `firstName`, `lastName`, `phone`, `email`, and `notes`. Non-existent ID returns a failure response.
- **Fail:** Any field is missing or incorrect, or the not-found case does not return an error envelope.
