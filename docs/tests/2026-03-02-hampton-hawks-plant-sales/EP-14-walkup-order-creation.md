---
scenario_id: "EP-14"
title: "Walk-up order creation"
tool: "bash"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario EP-14: Walk-up order creation

## Description
Verifies the full walk-up order creation workflow: creating a plant with inventory, placing a walk-up order with customer info, adding an order line, and confirming the plant appears in the walk-up availability list. Steps must run in order due to state dependencies.

## Preconditions
- API is running at http://localhost:8080
- No specific existing data required

## Steps
1. Create a new plant via `POST /api/plants` with a unique name (e.g. `Walkup Test Plant`). Record the returned `id` as `{plantId}`.
2. Set inventory for the plant via `POST /api/inventory` (or the appropriate inventory endpoint) with `plantCatalogId: {plantId}` and `onHandQty: 20`. Record the inventory record `id` if needed.
3. Call `GET /api/walkup/availability` and verify the new plant appears in the list with `AvailableForWalkup > 0`.
4. Create a walk-up order via `POST /api/walkup/orders` with a body containing customer info (e.g. `customerName`, `customerEmail`, or equivalent fields). Record the returned order `id` as `{orderId}`.
5. Verify the response returns HTTP 200 (or 201) and `success: true`.
6. Verify the returned order object has `IsWalkUp: true` (or `isWalkUp: true`).
7. Add an order line via `POST /api/walkup/orders/{orderId}/lines` with a body containing `plantCatalogId: {plantId}` and `qty: 2` (or `quantity: 2`).
8. Verify the response returns HTTP 200 (or 201) and `success: true`.
9. Verify the returned line record references the correct `plantCatalogId` and quantity.
10. Call `GET /api/walkup/availability` again and verify the available quantity for the plant has decreased by 2.

## Expected Results
- Plant is created and inventory is set to 20.
- `GET /api/walkup/availability` shows the plant with `AvailableForWalkup > 0` before and after order creation.
- `POST /api/walkup/orders` creates an order with `IsWalkUp: true`.
- `POST /api/walkup/orders/{orderId}/lines` successfully adds a line item for the plant.
- Available walk-up quantity decreases by the ordered amount after the line is added.

## Execution Tool
bash -- Use curl to call API endpoints

## Pass / Fail Criteria
- **Pass:** Walk-up order is created with `IsWalkUp: true`, order line is added successfully, and availability decreases by the correct amount.
- **Fail:** Order is created without `IsWalkUp: true`, order line creation fails, or availability does not decrease after the line is added.
