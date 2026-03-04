---
scenario_id: "EP-25"
title: "Get Plant by ID"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - plants
---

## Description

Verify that `GET /api/plants/{id}` returns the full plant record with all fields populated when a valid ID is provided, and returns an appropriate error for non-existent IDs.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `PlantCatalog` entity and related services are registered in the DI container.
- No pre-existing plant records exist in the database.

## Steps

1. **Seed test data:** Insert 1 plant into the database:
   - `{ sku: "PLT-100", name: "Lavender", variant: "English", price: 9.99, barcode: "2000000001", isActive: true }`

2. **Send request:** `GET /api/plants/{id}` using the seeded plant's ID.

3. **Verify all fields:** Assert the response contains:
   - `id` matches the seeded plant's ID
   - `sku` is `"PLT-100"`
   - `name` is `"Lavender"`
   - `variant` is `"English"`
   - `price` is `9.99`
   - `barcode` is `"2000000001"`
   - `isActive` is `true`
   - `createdAt` is a valid timestamp
   - `updatedAt` is a valid timestamp

4. **Verify not found:** Send `GET /api/plants/{nonExistentId}` with a random GUID/ID. Assert that the response indicates failure or returns a 404-equivalent in the envelope.

## Expected Results

- `GET /api/plants/{id}` returns `ApiResponse<T>` with `success: true` and `data` containing all plant fields with correct values.
- `GET /api/plants/{nonExistentId}` returns `ApiResponse<T>` with `success: false` and an appropriate error message.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP25"
```

## Pass/Fail Criteria

- **Pass:** All fields are present and match seeded values. Non-existent ID returns a failure response.
- **Fail:** Any field is missing or incorrect, or the not-found case does not return an error envelope.
