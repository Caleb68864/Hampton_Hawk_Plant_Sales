---
scenario_id: "EP-26"
title: "Create Plant with Auto-Created Inventory Record"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - plants
  - inventory
---

## Description

Verify that `POST /api/plants` creates a new plant record and automatically creates an associated `Inventory` record with `OnHandQty = 0`.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `PlantCatalog` and `Inventory` entities and related services are registered in the DI container.
- No pre-existing plant or inventory records exist in the database.

## Steps

1. **Send create request:** `POST /api/plants` with body:
   ```json
   {
     "sku": "PLT-200",
     "name": "Sunflower",
     "variant": "Giant",
     "price": 5.50,
     "barcode": "3000000001",
     "isActive": true
   }
   ```

2. **Verify plant created:** Assert the response has `success: true` and the `data` contains:
   - `sku` is `"PLT-200"`
   - `name` is `"Sunflower"`
   - `variant` is `"Giant"`
   - `price` is `5.50`
   - `barcode` is `"3000000001"`
   - `isActive` is `true`
   - `id` is a valid non-default identifier
   - `createdAt` is set to a recent timestamp

3. **Verify inventory auto-created:** Query the `Inventory` table for the newly created plant's ID. Assert:
   - An `Inventory` record exists linked to the new plant's `PlantCatalogId`
   - `OnHandQty` is `0`

4. **Verify SKU uniqueness:** Send another `POST /api/plants` with the same SKU `"PLT-200"`. Assert the response has `success: false` with a validation error about duplicate SKU.

## Expected Results

- Plant is created successfully and returned in the `ApiResponse<T>` envelope with `success: true`.
- An `Inventory` record is automatically created with `OnHandQty = 0` for the new plant.
- Attempting to create a plant with a duplicate SKU returns `success: false` with a meaningful error.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP26"
```

## Pass/Fail Criteria

- **Pass:** Plant is created with correct fields, inventory record is auto-created with `OnHandQty = 0`, and duplicate SKU is rejected.
- **Fail:** Plant creation fails unexpectedly, no inventory record is created, inventory `OnHandQty` is not `0`, or duplicate SKU is accepted.
