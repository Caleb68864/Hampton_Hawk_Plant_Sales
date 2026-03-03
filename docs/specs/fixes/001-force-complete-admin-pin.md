---
title: "Fix: Force-Complete Endpoint Missing Admin PIN Check"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: critical
failing_scenarios: [SR-11]
tags:
  - fix
  - security
  - critical
---

# Fix: Force-Complete Endpoint Missing Admin PIN Check

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: CRITICAL
- Failing Scenarios: SR-11

## Outcome
`POST /api/orders/{id}/force-complete` requires a valid `X-Admin-Pin` header (matching `APP_ADMIN_PIN` env var) and `X-Admin-Reason` header. Requests without valid headers receive HTTP 403.

## Context
The force-complete endpoint allows closing an order even when not all lines are fulfilled. Currently, it has NO authorization check -- any unauthenticated request can force-complete any order. This is a critical security gap.

The admin PIN pattern is already implemented on other endpoints (sale-closed toggle, reset order). The `AdminPinFilter` or equivalent middleware exists and is applied to those endpoints but was missed on force-complete.

## Requirements
- `POST /api/orders/{id}/force-complete` must validate `X-Admin-Pin` header against `APP_ADMIN_PIN`
- Missing or incorrect PIN returns HTTP 403 with `{ success: false, errors: [...] }`
- Missing `X-Admin-Reason` header returns HTTP 403
- Correct PIN + Reason allows the force-complete to proceed (existing behavior)
- An `AdminAction` audit record should be created on successful force-complete

## Sub-Specs

### 1. Add Admin PIN Check to Force-Complete
**Scope:** Apply the same admin PIN authorization used on other admin endpoints to the force-complete action.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Api/Controllers/OrdersController.cs` (or wherever force-complete is handled)
**Acceptance criteria:**
- Force-complete without headers returns 403
- Force-complete with wrong PIN returns 403
- Force-complete with correct PIN + reason returns 200 and completes the order
- Existing force-complete behavior (order status -> Complete, hasIssue flag) is unchanged
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-11`
