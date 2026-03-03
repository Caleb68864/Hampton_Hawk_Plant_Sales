---
title: "Fix: Add Admin Actions Query Endpoint"
project: "Hampton Hawks Plant Sales"
date: 2026-03-03
type: spec
severity: medium
failing_scenarios: [SR-10]
tags:
  - fix
  - admin
  - medium
---

# Fix: Add Admin Actions Query Endpoint

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-03
- Author: Forge
- Severity: MEDIUM
- Failing Scenarios: SR-10

## Outcome
`GET /api/admin-actions` returns a list of admin action audit records, filterable by `orderId`, `entityType`, and `actionType`. The endpoint requires a valid `X-Admin-Pin` header for access.

## Context
The `AdminAction` model and `AdminService.LogActionAsync()` already exist and are used by force-complete, sale-closed toggle, reset-order, and walk-up override operations. However, there is no endpoint to QUERY admin actions. Test scenario SR-10 (step 9) calls `GET /api/admin-actions?orderId={ORDER_ID}` to verify that a force-complete action was logged, but this endpoint does not exist.

The `AdminAction` entity has these fields: `Id`, `ActionType`, `EntityType`, `EntityId`, `Reason`, `Message`, `CreatedAt`.

## Requirements
- `GET /api/admin-actions` returns all admin action records wrapped in `ApiResponse<List<AdminActionResponse>>`
- Supports optional query params: `orderId` (filters by EntityId where EntityType=Order), `entityType`, `actionType`
- Requires `X-Admin-Pin` header (same validation as other admin endpoints)
- Missing or wrong PIN returns HTTP 403
- Returns records ordered by `CreatedAt` descending (newest first)

## Sub-Specs

### 1. Create AdminActionsController with GET Endpoint
**Scope:** Add a new controller (or add to an existing admin controller) with a GET endpoint that queries `AdminAction` records from the database.
**Files likely touched:**
- New: `api/src/HamptonHawksPlantSales.Api/Controllers/AdminActionsController.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/AdminDtos.cs` (add `AdminActionResponse` DTO if not exists)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IAdminService.cs` (add query method)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/AdminService.cs` (implement query)
**Acceptance criteria:**
- `GET /api/admin-actions` with valid PIN returns all admin actions
- `GET /api/admin-actions?orderId={id}` with valid PIN returns actions where `EntityId` matches the order ID
- `GET /api/admin-actions` without PIN header returns HTTP 403
- Response includes `id`, `actionType`, `entityType`, `entityId`, `reason`, `message`, `createdAt` fields
- After a force-complete with reason "test", the admin actions list contains an entry with `reason: "test"` and the correct `entityId`
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-10`
