---
title: "Fix: POST Endpoints Return 201 Instead of Expected 200"
project: "Hampton Hawks Plant Sales"
date: 2026-03-03
type: spec
severity: low
failing_scenarios: [EP-02, EP-03]
tags:
  - fix
  - api
  - low
---

# Fix: POST Endpoints Return 201 Instead of Expected 200

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-03
- Author: Forge
- Severity: LOW
- Failing Scenarios: EP-02, EP-03

## Outcome
All `POST` create endpoints return HTTP 200 with `{ success: true, data: {...} }` instead of HTTP 201 with `CreatedAtAction`. The test scenarios expect HTTP 200 for consistency with the rest of the API.

## Context
The create endpoints for customers, sellers, orders, plants, and walk-up orders use `CreatedAtAction(...)` which returns HTTP 201. The test scenarios (EP-02, EP-03) explicitly check for HTTP 200 on create operations. While 201 is technically correct for REST, this project's convention is to always return 200 with the `ApiResponse<T>` envelope for successful operations.

All POST create actions in these controllers use `CreatedAtAction`:
- `CustomersController.Create` (line 79)
- `SellersController.Create` (line 79)
- `PlantsController.Create` (line 86)
- `OrdersController.Create` (line 88)
- `OrdersController.AddLine` (line 134)
- `WalkUpController.CreateOrder` (line 33)
- `WalkUpController.AddLine` (line 51)

## Requirements
- All POST create endpoints return HTTP 200 with `ApiResponse<T>.Ok(result)`
- Replace `CreatedAtAction(...)` with `Ok(ApiResponse<T>.Ok(result))` in all controllers
- No change to the response body structure -- only the HTTP status code changes

## Sub-Specs

### 1. Change All POST Create Endpoints to Return 200
**Scope:** Replace `CreatedAtAction(...)` with `Ok(...)` in all controller POST actions.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Api/Controllers/CustomersController.cs`
- `api/src/HamptonHawksPlantSales.Api/Controllers/SellersController.cs`
- `api/src/HamptonHawksPlantSales.Api/Controllers/PlantsController.cs`
- `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs`
- `api/src/HamptonHawksPlantSales.Api/Controllers/WalkUpController.cs`
**Acceptance criteria:**
- `POST /api/customers` returns HTTP 200 with `success: true` (not 201)
- `POST /api/sellers` returns HTTP 200 with `success: true` (not 201)
- `POST /api/plants` returns HTTP 200 with `success: true` (not 201)
- `POST /api/orders` returns HTTP 200 with `success: true` (not 201)
- `POST /api/walkup/orders` returns HTTP 200 with `success: true` (not 201)
- `POST /api/walkup/orders/{id}/lines` returns HTTP 200 with `success: true` (not 201)
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-02`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-03`
