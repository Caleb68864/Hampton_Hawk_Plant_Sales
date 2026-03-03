---
title: "Fix: Response Envelope Consistency"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: medium
failing_scenarios: [EP-09, SR-19]
tags:
  - fix
  - api
  - medium
---

# Fix: Response Envelope Consistency

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: MEDIUM
- Failing Scenarios: EP-09, SR-19

## Outcome
All API responses use the standard envelope format `{ success, data, errors }`. This includes the version endpoint, 404 responses, and 400 validation errors.

## Context
Three envelope inconsistencies found:
1. `GET /api/version` returns bare `{"version":"1.0.0"}` instead of `{"success":true,"data":{"version":"1.0.0"},"errors":[]}`
2. 404 for unknown routes returns empty body (Content-Length: 0) instead of `{"success":false,"data":null,"errors":["Not found"]}`
3. 400 validation errors return `{"success":false,"errors":[...]}` but are missing the `data` field (should include `"data": null`)

## Requirements
- `GET /api/version` wraps response in `ApiResponse<T>` envelope
- Unknown routes return JSON envelope with 404 status
- All error responses include `data: null` field
- Existing endpoint responses are not affected

## Sub-Specs

### 1. Wrap Version Endpoint in Envelope
**Scope:** Change `VersionController` to return `ApiResponse<T>.Ok(result)` like all other controllers.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Api/Controllers/VersionController.cs`
**Acceptance criteria:**
- `GET /api/version` returns `{"success":true,"data":{"version":"1.0.0"},"errors":[]}`
**Dependencies:** none

### 2. Add Global 404 Handler with Envelope
**Scope:** Add middleware or fallback route that returns a JSON envelope for unmatched routes.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Api/Program.cs` or middleware configuration
**Acceptance criteria:**
- `GET /api/nonexistent` returns HTTP 404 with `{"success":false,"data":null,"errors":["Not found"]}`
- Content-Type is `application/json`
**Dependencies:** none

### 3. Ensure data Field on Error Responses
**Scope:** Ensure the `ApiResponse` error factory always includes `data: null`.
**Files likely touched:** `api/src/HamptonHawksPlantSales.Core/Models/ApiResponse.cs` (or equivalent)
**Acceptance criteria:**
- 400 responses include `"data": null` alongside `success` and `errors`
**Dependencies:** none

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario EP-09`
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario SR-19`
