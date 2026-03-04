---
scenario_id: "EP-32"
title: "Update Customer Phone and Email"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - customers
---

## Description

Verify that `PUT /api/customers/{id}` updates a customer's phone and email, and that the changes are persisted correctly.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Customer` entity and related services are registered in the DI container.
- No pre-existing customer records exist in the database.

## Steps

1. **Seed test data:** Insert 1 customer into the database:
   - `{ displayName: "Dana White", firstName: "Dana", lastName: "White", phone: "555-0401", email: "dana.white@example.com", notes: "Original notes" }`

2. **Send update request:** `PUT /api/customers/{customer.id}` with body:
   ```json
   {
     "displayName": "Dana White",
     "firstName": "Dana",
     "lastName": "White",
     "phone": "555-0499",
     "email": "dana.updated@example.com",
     "notes": "Original notes"
   }
   ```

3. **Verify update response:** Assert `success: true` and:
   - `phone` is `"555-0499"`
   - `email` is `"dana.updated@example.com"`
   - Other fields remain unchanged (`displayName`, `firstName`, `lastName`, `notes`)

4. **Verify persistence:** Send `GET /api/customers/{customer.id}` and confirm:
   - `phone` is `"555-0499"`
   - `email` is `"dana.updated@example.com"`

5. **Verify updatedAt changed:** Assert that `updatedAt` on the updated customer is later than `createdAt`.

## Expected Results

- `PUT /api/customers/{id}` returns `ApiResponse<T>` with `success: true` and the updated customer data.
- Phone and email changes are persisted and confirmed via a subsequent GET.
- `updatedAt` reflects the modification time.
- Unchanged fields retain their original values.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP32"
```

## Pass/Fail Criteria

- **Pass:** Phone and email are updated and persisted, `updatedAt` is refreshed, and unchanged fields are preserved.
- **Fail:** Update does not persist, fields are incorrect, `updatedAt` is not updated, or other fields are inadvertently changed.
