---
scenario_id: "EP-40"
title: "Set Inventory Quantity"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - inventory
---

## Description

Verify that `PUT /api/inventory/{plantId}` sets the inventory quantity to an absolute value, persists the change, and creates an `InventoryAdjustment` audit record.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Inventory`, `PlantCatalog`, and `InventoryAdjustment` entities and related services are registered in the DI container.
- No pre-existing records exist in the database.

## Steps

1. **Seed test data:** Insert 1 plant with an inventory record:
   - Plant: `{ sku: "PLT-600", name: "Hydrangea", variant: "Blue", price: 15.00 }`
   - Inventory: `{ onHandQty: 10 }` linked to the plant

2. **Send set quantity request:** `PUT /api/inventory/{plant.id}` with body:
   ```json
   {
     "onHandQty": 25,
     "reason": "Physical count"
   }
   ```
   Include required admin headers (`X-Admin-Pin`, `X-Admin-Reason`).

3. **Verify response:** Assert `success: true` and the returned inventory shows `onHandQty: 25`.

4. **Verify persistence:** Send `GET /api/inventory/{plant.id}` (or query the inventory table directly) and confirm `onHandQty` is `25`.

5. **Verify InventoryAdjustment created:** Query the `InventoryAdjustments` table for the plant's inventory ID. Assert:
   - An adjustment record exists
   - `oldQty` is `10`
   - `newQty` is `25`
   - `reason` is `"Physical count"`
   - `createdAt` is a valid recent timestamp

## Expected Results

- `PUT /api/inventory/{plantId}` returns `ApiResponse<T>` with `success: true` and `onHandQty` set to `25`.
- The inventory quantity is persisted as `25`.
- An `InventoryAdjustment` record is created with `oldQty: 10`, `newQty: 25`, and `reason: "Physical count"`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~EP40"
```

## Pass/Fail Criteria

- **Pass:** Inventory is set to the new quantity, persistence is confirmed, and an audit adjustment record is created with correct old/new quantities and reason.
- **Fail:** Quantity is not updated, persistence check fails, or the `InventoryAdjustment` record is missing or has incorrect values.
