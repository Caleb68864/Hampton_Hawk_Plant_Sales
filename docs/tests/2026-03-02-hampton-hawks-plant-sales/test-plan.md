---
title: "Hampton Hawks Plant Sales Test Plan"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: test-plan
tags:
  - test-plan
  - hampton-hawks-plant-sales
---

# Test Plan: Hampton Hawks Plant Sales

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Spec Source: docs/specs/2026-03-02-hampton-hawks-plant-sales.md + spec.md
- Scope: Full Codebase

## Prerequisites
- Docker Compose running: `docker-compose up -d --build`
- API at http://localhost:8080, Web at http://localhost:3000
- Empty database (fresh start) -- each test creates its own data
- Admin PIN: `1234` (from docker-compose.yml)
- Test framework: xUnit (backend), Playwright (UI/E2E)

## Scenarios

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-01 | Plants CRUD endpoints | Endpoints | Medium | No |
| EP-02 | Customers CRUD endpoints | Endpoints | Medium | No |
| EP-03 | Sellers CRUD endpoints | Endpoints | Medium | No |
| EP-04 | Orders CRUD with lines | Endpoints | High | Yes |
| EP-05 | Inventory set and adjust | Endpoints | High | Yes |
| EP-06 | Import plants CSV | Endpoints | Medium | Yes |
| EP-07 | Import inventory CSV | Endpoints | Medium | Yes |
| EP-08 | Import orders CSV | Endpoints | Medium | Yes |
| EP-09 | Response envelope format | Endpoints | High | No |
| EP-10 | Pagination enforcement | Endpoints | Medium | No |
| EP-11 | Soft delete behavior | Endpoints | Medium | No |
| EP-12 | Settings and SaleClosed toggle | Endpoints | High | Yes |
| EP-13 | Reports dashboard metrics | Endpoints | Medium | No |
| EP-14 | Walk-up order creation | Endpoints | High | Yes |
| EP-15 | Walk-up inventory protection | Endpoints | High | Yes |
| SR-01 | Scan happy path -- accepted | Spec Req | Critical | Yes |
| SR-02 | Scan -- SaleClosed blocks all | Spec Req | Critical | Yes |
| SR-03 | Scan -- wrong order hard block | Spec Req | Critical | Yes |
| SR-04 | Scan -- already fulfilled | Spec Req | High | Yes |
| SR-05 | Scan -- out of stock | Spec Req | High | Yes |
| SR-06 | Scan -- barcode not found | Spec Req | High | Yes |
| SR-07 | Undo last scan | Spec Req | High | Yes |
| SR-08 | Undo blocked when SaleClosed | Spec Req | High | Yes |
| SR-09 | Complete order -- all fulfilled | Spec Req | High | Yes |
| SR-10 | Force complete -- admin PIN | Spec Req | High | Yes |
| SR-11 | Force complete -- no PIN returns 403 | Spec Req | High | No |
| SR-12 | Reset order -- admin | Spec Req | High | Yes |
| SR-13 | Admin PIN protocol -- missing headers | Spec Req | High | No |
| SR-14 | Walk-up exceeds available -- blocked | Spec Req | Critical | Yes |
| SR-15 | Walk-up admin override bypasses protection | Spec Req | High | Yes |
| SR-16 | Barcode locked after first scan | Spec Req | High | Yes |
| SR-17 | SaleClosed -- admin can still force complete | Spec Req | Critical | Yes |
| SR-18 | Duplicate barcode import skipped | Spec Req | Medium | Yes |
| SR-19 | Version endpoint returns data | Spec Req | Low | No |
| UI-01 | Dashboard loads without errors | UI | High | No |
| UI-02 | Pickup scan workflow -- end to end | UI | Critical | Yes |
| UI-03 | A-Z tabs filter customers | UI | Medium | No |
| UI-04 | Quick find overlay (Ctrl+K) | UI | Medium | No |
| UI-05 | SaleClosed banner visible | UI | High | Yes |
| UI-06 | Print order sheet renders | UI | Medium | No |
| UI-07 | Footer shows "Powered by Logic NE" | UI | Medium | No |
| DB-01 | Concurrent scan safety | Database | Critical | Yes |
| DB-02 | Soft delete excludes from queries | Database | Medium | No |
| DB-03 | Audit timestamps set correctly | Database | Medium | Yes |

See individual scenario files in this directory for full steps and expected results.

## Coverage Summary
- Total scenarios: 42
- Endpoints covered: 15/44 (grouped by controller/feature)
- UI scenarios: 7
- Database scenarios: 3
- Spec requirement scenarios: 19
- Sequential scenarios: 26 (must run in order due to state mutations)
