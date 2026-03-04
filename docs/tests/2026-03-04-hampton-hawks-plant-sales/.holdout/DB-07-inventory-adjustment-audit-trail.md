---
scenario_id: "DB-07"
title: "Inventory Adjustment Audit Trail"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
  - inventory
  - audit
---

## Description

Verify that after performing `SetInventory` and `AdjustInventory` operations, the `InventoryAdjustments` table contains complete audit entries with correct `oldQty`, `newQty`, `reason`, and timestamps.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `Inventory`, `PlantCatalog`, and `InventoryAdjustment` entities and related services are registered in the DI container.
- No pre-existing records exist in the database.

## Steps

1. **Seed test data:** Insert 1 plant with an inventory record:
   - Plant: `{ sku: "PLT-800", name: "Orchid", variant: "White", price: 22.00 }`
   - Inventory: `{ onHandQty: 15 }` linked to the plant

2. **Perform SetInventory:** Call `PUT /api/inventory/{plant.id}` with body:
   ```json
   {
     "onHandQty": 50,
     "reason": "Initial stock count"
   }
   ```
   Include required admin headers.

3. **Perform AdjustInventory (negative):** Call `POST /api/inventory/adjust` with body:
   ```json
   {
     "plantCatalogId": "{plant.id}",
     "deltaQty": -5,
     "reason": "Sold at walk-up"
   }
   ```
   Include required admin headers.

4. **Perform AdjustInventory (positive):** Call `POST /api/inventory/adjust` with body:
   ```json
   {
     "plantCatalogId": "{plant.id}",
     "deltaQty": 10,
     "reason": "Delivery received"
   }
   ```
   Include required admin headers.

5. **Query InventoryAdjustments:** Retrieve all `InventoryAdjustment` records for the plant's inventory ID, ordered by `CreatedAt`.

6. **Verify adjustment 1 (SetInventory):** Assert:
   - `oldQty` is `15`
   - `newQty` is `50`
   - `reason` is `"Initial stock count"`
   - `createdAt` is a valid timestamp

7. **Verify adjustment 2 (AdjustInventory -5):** Assert:
   - `oldQty` is `50`
   - `newQty` is `45`
   - `reason` is `"Sold at walk-up"`
   - `createdAt` is a valid timestamp and is later than adjustment 1's `createdAt`

8. **Verify adjustment 3 (AdjustInventory +10):** Assert:
   - `oldQty` is `45`
   - `newQty` is `55`
   - `reason` is `"Delivery received"`
   - `createdAt` is a valid timestamp and is later than adjustment 2's `createdAt`

9. **Verify total count:** Assert there are exactly 3 `InventoryAdjustment` records for this inventory.

10. **Verify final inventory state:** Confirm the current `onHandQty` is `55`.

## Expected Results

- The `InventoryAdjustments` table contains 3 records in chronological order.
- Each record has correct `oldQty` and `newQty` reflecting the chain of operations: `15 -> 50 -> 45 -> 55`.
- Each record has a non-empty `reason` matching the operation performed.
- Timestamps are in ascending order and all are valid.
- The final inventory `onHandQty` is `55`.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~DB07"
```

## Pass/Fail Criteria

- **Pass:** All 3 adjustment records exist with correct `oldQty`, `newQty`, `reason`, and chronologically ordered timestamps. Final inventory is `55`.
- **Fail:** Any adjustment record is missing, has incorrect `oldQty`/`newQty`, has a missing or wrong `reason`, timestamps are not in order, or the final inventory quantity does not match the expected `55`.
