---
scenario_id: "SR-01"
title: "Sale closed blocks fulfillment operations except admin force-complete"
tool: "bash"
type: test-scenario
sequential: false
tags:
  - test-scenario
  - spec-requirement
  - sale-closed
  - fulfillment
---

# Scenario SR-01: Sale closed blocks fulfillment operations except admin force-complete

## Description

Verifies that when `SaleClosed=true`, the following fulfillment operations are blocked: `POST /api/orders/{id}/scan`, `POST /api/orders/{id}/undo-last-scan`, and `POST /api/orders/{id}/manual-fulfill`. The admin override endpoint `POST /api/orders/{id}/force-complete` should still succeed when provided with valid admin PIN and reason headers.

## Preconditions

- An in-memory EF Core database is configured with global query filters for soft delete.
- The `IFulfillmentService`, `ISettingsService`, and `AdminPinActionFilter` are registered in the DI container.
- The admin PIN is configured.
- An Order exists with status `Open` or `InProgress`, with at least one OrderLine linked to a plant with inventory.
- `SaleClosed` is set to `true` in `AppSettings`.

## Steps

1. **Seed test data:**
   - Plant with barcode `"SCAN-001"` and Inventory `{ onHandQty: 10 }`
   - Customer and Order with one OrderLine (QtyOrdered=3, QtyFulfilled=0)
   - Set `AppSettings.SaleClosed = true`

2. **Attempt scan:** `POST /api/orders/{orderId}/scan` with body `{ "barcode": "SCAN-001" }`
   - Assert response indicates sale-closed block (HTTP 200 with `result: "SaleClosedBlocked"`, or service returns the appropriate blocked result).

3. **Attempt undo last scan:** `POST /api/orders/{orderId}/undo-last-scan`
   - Assert response returns HTTP 400 with `success: false` and error message `"Sale is closed."`.

4. **Attempt manual fulfill:** `POST /api/orders/{orderId}/manual-fulfill` with body `{ "orderLineId": "<lineId>", "reason": "Test", "operatorName": "Tester" }`
   - Assert response returns HTTP 400 with `success: false` and error message `"Sale is closed."`.

5. **Force-complete succeeds:** `POST /api/orders/{orderId}/force-complete`
   - Headers: `X-Admin-Pin: <valid_pin>`, `X-Admin-Reason: "Emergency override"`
   - Assert response returns HTTP 200 with `success: true`.
   - Verify the order status is updated to `Completed`.

## Expected Results

- `POST /api/orders/{id}/scan` is blocked when sale is closed.
- `POST /api/orders/{id}/undo-last-scan` returns HTTP 400 with `"Sale is closed."`.
- `POST /api/orders/{id}/manual-fulfill` returns HTTP 400 with `"Sale is closed."`.
- `POST /api/orders/{id}/force-complete` with valid admin PIN and reason succeeds (HTTP 200) and completes the order.

## Execution Tool

```bash
cd api && dotnet test HamptonHawksPlantSales.sln --filter "FullyQualifiedName~SR01"
```

## Pass/Fail Criteria

- **Pass:** All assertions succeed -- scan, undo, and manual-fulfill are blocked when sale is closed; force-complete with admin credentials succeeds.
- **Fail:** Any assertion fails -- a blocked operation succeeds, or force-complete fails despite valid credentials.
