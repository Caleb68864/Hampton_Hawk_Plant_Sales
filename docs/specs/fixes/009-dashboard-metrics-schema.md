---
title: "Fix: Dashboard Metrics Missing Fields"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: medium
failing_scenarios: [EP-13]
tags:
  - fix
  - reports
  - medium
---

# Fix: Dashboard Metrics Missing Fields

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: MEDIUM
- Failing Scenarios: EP-13

## Outcome
`GET /api/reports/dashboard-metrics` returns all required fields: `totalOrders`, `openOrders`, `completedOrders`, `totalCustomers`, `totalSellers`, `lowInventoryCount`, `problemOrderCount`, plus existing fields.

## Context
The dashboard metrics endpoint currently returns: `totalOrders`, `ordersByStatus`, `totalItemsOrdered`, `totalItemsFulfilled`, `saleProgressPercent`. It is missing: `openOrders`, `completedOrders`, `totalCustomers`, `totalSellers`, `lowInventoryCount`, `problemOrderCount`.

The frontend `DashboardPage.tsx` already expects `openOrders`, `completedOrders`, `totalCustomers`, `totalSellers`, `lowInventoryCount`, `problemOrderCount` -- these are defined in the `DashboardMetrics` TypeScript type. The API DTO needs to match.

## Requirements
- Add `openOrders` (count of orders with status Open/InProgress)
- Add `completedOrders` (count of orders with status Complete)
- Add `totalCustomers` (count of active customers)
- Add `totalSellers` (count of active sellers)
- Add `lowInventoryCount` (count of plants where onHandQty < threshold, e.g., 5)
- Add `problemOrderCount` (count of orders with `hasIssue = true`)
- Existing fields can remain for backwards compatibility

## Sub-Specs

### 1. Add Missing Fields to Dashboard Metrics DTO and Service
**Scope:** Add the missing counts to the metrics response.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs` (DashboardMetricsResponse)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs`
**Acceptance criteria:**
- `GET /api/reports/dashboard-metrics` response includes `openOrders`, `completedOrders`, `totalCustomers`, `totalSellers`, `lowInventoryCount`, `problemOrderCount`
- Values are accurate counts from the database
- Existing fields (`totalOrders`, `ordersByStatus`, etc.) are unchanged
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-13`
