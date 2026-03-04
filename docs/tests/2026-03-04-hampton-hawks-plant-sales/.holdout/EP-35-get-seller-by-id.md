---
scenario_id: "EP-35"
title: "Get Seller by ID"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - sellers
---

## Description

Verify that `GET /api/sellers/{id}` returns the full seller record with all fields populated when a valid ID is provided.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Seller` entity and related services are registered in the DI container.
- No pre-existing seller records exist in the database.

## Steps

1. **Seed test data:** Insert 1 seller into the database:
   - `{ displayName: "Lily Chen", firstName: "Lily", lastName: "Chen", grade: "5th", teacher: "Ms. Thompson", notes: "Award winner last year" }`

2. **Send request:** `GET /api/sellers/{id}` using the seeded seller's ID.

3. **Verify all fields:** Assert the response contains:
   - `id` matches the seeded seller's ID
   - `displayName` is `"Lily Chen"`
   - `firstName` is `"Lily"`
   - `lastName` is `"Chen"`
   - `grade` is `"5th"`
   - `teacher` is `"Ms. Thompson"`
   - `notes` is `"Award winner last year"`
   - `createdAt` is a valid timestamp
   - `updatedAt` is a valid timestamp

4. **Verify not found:** Send `GET /api/sellers/{nonExistentId}` with a random GUID/ID. Assert that the response indicates failure with `success: false`.

## Expected Results

- `GET /api/sellers/{id}` returns `ApiResponse<T>` with `success: true` and `data` containing all seller fields with correct values.
- `GET /api/sellers/{nonExistentId}` returns `ApiResponse<T>` with `success: false` and an appropriate error message.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP35"
```

## Pass/Fail Criteria

- **Pass:** All fields are present and match seeded values including `displayName`, `firstName`, `lastName`, `grade`, `teacher`, and `notes`. Non-existent ID returns a failure response.
- **Fail:** Any field is missing or incorrect, or the not-found case does not return an error envelope.
