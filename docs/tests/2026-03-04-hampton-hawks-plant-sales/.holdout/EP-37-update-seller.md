---
scenario_id: "EP-37"
title: "Update Seller Grade and Teacher"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - sellers
---

## Description

Verify that `PUT /api/sellers/{id}` updates a seller's grade and teacher, and that the changes are persisted correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Seller` entity and related services are registered in the DI container.
- No pre-existing seller records exist in the database.

## Steps

1. **Seed test data:** Insert 1 seller into the database:
   - `{ displayName: "Olivia Grant", firstName: "Olivia", lastName: "Grant", grade: "3rd", teacher: "Mrs. Baker", notes: "Enthusiastic" }`

2. **Send update request:** `PUT /api/sellers/{seller.id}` with body:
   ```json
   {
     "displayName": "Olivia Grant",
     "firstName": "Olivia",
     "lastName": "Grant",
     "grade": "4th",
     "teacher": "Mr. Davis",
     "notes": "Enthusiastic"
   }
   ```

3. **Verify update response:** Assert `success: true` and:
   - `grade` is `"4th"`
   - `teacher` is `"Mr. Davis"`
   - Other fields remain unchanged (`displayName`, `firstName`, `lastName`, `notes`)

4. **Verify persistence:** Send `GET /api/sellers/{seller.id}` and confirm:
   - `grade` is `"4th"`
   - `teacher` is `"Mr. Davis"`

5. **Verify updatedAt changed:** Assert that `updatedAt` on the updated seller is later than `createdAt`.

## Expected Results

- `PUT /api/sellers/{id}` returns `ApiResponse<T>` with `success: true` and the updated seller data.
- Grade and teacher changes are persisted and confirmed via a subsequent GET.
- `updatedAt` reflects the modification time.
- Unchanged fields retain their original values.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP37"
```

## Pass/Fail Criteria

- **Pass:** Grade and teacher are updated and persisted, `updatedAt` is refreshed, and unchanged fields are preserved.
- **Fail:** Update does not persist, fields are incorrect, `updatedAt` is not updated, or other fields are inadvertently changed.
