---
scenario_id: "EP-27"
title: "Update Plant Name and Price"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - plants
---

## Description

Verify that `PUT /api/plants/{id}` updates a plant's name and price, persists the changes, and validates SKU uniqueness on update.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `PlantCatalog` entity and related services are registered in the DI container.
- No pre-existing plant records exist in the database.

## Steps

1. **Seed test data:** Insert 2 plants into the database:
   - Plant A: `{ sku: "PLT-300", name: "Petunia", variant: "Purple", price: 4.25, barcode: "4000000001", isActive: true }`
   - Plant B: `{ sku: "PLT-301", name: "Marigold", variant: "Orange", price: 3.75, barcode: "4000000002", isActive: true }`

2. **Send update request:** `PUT /api/plants/{plantA.id}` with body:
   ```json
   {
     "sku": "PLT-300",
     "name": "Petunia Deluxe",
     "variant": "Purple",
     "price": 5.99,
     "barcode": "4000000001",
     "isActive": true
   }
   ```

3. **Verify update response:** Assert `success: true` and `data.name` is `"Petunia Deluxe"` and `data.price` is `5.99`.

4. **Verify persistence:** Send `GET /api/plants/{plantA.id}` and confirm `name` is `"Petunia Deluxe"` and `price` is `5.99`.

5. **Verify updatedAt changed:** Assert that `updatedAt` on the updated plant is later than `createdAt`.

6. **Verify SKU uniqueness on update:** Send `PUT /api/plants/{plantA.id}` with `sku: "PLT-301"` (Plant B's SKU). Assert the response has `success: false` with a validation error about duplicate SKU.

## Expected Results

- `PUT /api/plants/{id}` returns `ApiResponse<T>` with `success: true` and the updated plant data.
- The name and price changes are persisted and confirmed via a subsequent GET.
- `updatedAt` reflects the modification time.
- Attempting to update to an existing SKU belonging to another plant returns `success: false`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP27"
```

## Pass/Fail Criteria

- **Pass:** Name and price are updated and persisted, `updatedAt` is set, and SKU uniqueness is enforced on update.
- **Fail:** Update does not persist, response fields are incorrect, `updatedAt` is not updated, or duplicate SKU is accepted.
