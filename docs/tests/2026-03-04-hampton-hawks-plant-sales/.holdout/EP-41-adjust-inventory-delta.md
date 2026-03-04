---
scenario_id: "EP-41"
title: "Adjust Inventory by Delta"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - inventory
---

## Description

Verify that `POST /api/inventory/adjust` adjusts the inventory quantity by a delta value (positive or negative), persists the change, and creates an `InventoryAdjustment` audit record.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Inventory`, `PlantCatalog`, and `InventoryAdjustment` entities and related services are registered in the DI container.
- No pre-existing records exist in the database.

## Steps

1. **Seed test data:** Insert 1 plant with an inventory record:
   - Plant: `{ sku: "PLT-700", name: "Peony", variant: "Pink", price: 18.00 }`
   - Inventory: `{ onHandQty: 40 }` linked to the plant

2. **Send adjust request (negative delta):** `POST /api/inventory/adjust` with body:
   ```json
   {
     "plantCatalogId": "{plant.id}",
     "deltaQty": -3,
     "reason": "Damaged"
   }
   ```
   Include required admin headers (`X-Admin-Pin`, `X-Admin-Reason`).

3. **Verify response:** Assert `success: true` and the returned inventory shows `onHandQty: 37`.

4. **Verify persistence:** Query the inventory record for the plant and confirm `onHandQty` is `37`.

5. **Verify InventoryAdjustment created:** Query the `InventoryAdjustments` table for the plant's inventory ID. Assert:
   - An adjustment record exists
   - `oldQty` is `40`
   - `newQty` is `37`
   - `reason` is `"Damaged"`
   - `createdAt` is a valid recent timestamp

6. **Send adjust request (positive delta):** `POST /api/inventory/adjust` with body:
   ```json
   {
     "plantCatalogId": "{plant.id}",
     "deltaQty": 5,
     "reason": "Restocked"
   }
   ```

7. **Verify second adjustment:** Assert `onHandQty` is now `42` (37 + 5). Verify a second `InventoryAdjustment` record exists with `oldQty: 37`, `newQty: 42`, `reason: "Restocked"`.

## Expected Results

- `POST /api/inventory/adjust` with `deltaQty: -3` decreases `onHandQty` from `40` to `37`.
- `POST /api/inventory/adjust` with `deltaQty: 5` increases `onHandQty` from `37` to `42`.
- Each adjustment creates a corresponding `InventoryAdjustment` record with correct `oldQty`, `newQty`, and `reason`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP41"
```

## Pass/Fail Criteria

- **Pass:** Inventory is correctly adjusted by the delta amounts (both negative and positive), persistence is confirmed, and audit adjustment records are created with correct values for each operation.
- **Fail:** Quantity is not adjusted correctly, persistence check fails, or `InventoryAdjustment` records are missing or have incorrect values.
