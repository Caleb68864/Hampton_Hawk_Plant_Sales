---
scenario_id: "EP-36"
title: "Create Seller"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - sellers
---

## Description

Verify that `POST /api/sellers` creates a new seller record with all provided fields persisted correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Seller` entity and related services are registered in the DI container.
- No pre-existing seller records exist in the database.

## Steps

1. **Send create request:** `POST /api/sellers` with body:
   ```json
   {
     "displayName": "Noah Patel",
     "firstName": "Noah",
     "lastName": "Patel",
     "grade": "2nd",
     "teacher": "Mr. Wallace",
     "notes": "First time seller"
   }
   ```

2. **Verify creation response:** Assert `success: true` and the `data` contains:
   - `displayName` is `"Noah Patel"`
   - `firstName` is `"Noah"`
   - `lastName` is `"Patel"`
   - `grade` is `"2nd"`
   - `teacher` is `"Mr. Wallace"`
   - `notes` is `"First time seller"`
   - `id` is a valid non-default identifier
   - `createdAt` is set to a recent timestamp

3. **Verify persistence:** Send `GET /api/sellers/{id}` using the returned ID. Confirm all fields match the create request.

4. **Verify listing:** Send `GET /api/sellers` and confirm the newly created seller appears in the results.

## Expected Results

- `POST /api/sellers` returns `ApiResponse<T>` with `success: true` and the full seller record in `data`.
- All fields (`displayName`, `firstName`, `lastName`, `grade`, `teacher`, `notes`) are persisted and retrievable.
- The seller appears in subsequent list queries.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP36"
```

## Pass/Fail Criteria

- **Pass:** Seller is created with all fields correct, is retrievable by ID, and appears in list queries.
- **Fail:** Creation fails, any field is missing or incorrect, or the seller is not retrievable after creation.
