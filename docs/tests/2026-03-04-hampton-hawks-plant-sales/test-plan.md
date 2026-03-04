---
title: "Hampton Hawks Plant Sales Test Plan"
project: "Hampton Hawks Plant Sales"
date: 2026-03-04
type: test-plan
tags:
  - test-plan
  - hampton-hawks-plant-sales
---

# Test Plan: Hampton Hawks Plant Sales

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-04
- Author: Forge
- Spec Source: Codebase scan + 13 sub-specs + 14 fix specs
- Scope: Full Codebase
- Priority: Fulfillment & Scan Engine first
- Edge Cases: Concurrency & data integrity
- Data Strategy: Self-contained (TestDataBuilder + InMemory DB)
- Test Framework: xUnit 2.x + Moq 4.x + FluentAssertions 6.x + EF Core InMemory

## Prerequisites
- .NET 9 SDK installed
- `cd api && dotnet build HamptonHawksPlantSales.sln` succeeds
- InMemory database provider (already in test project)
- TestDataBuilder and MockDbContextFactory helpers available
- No external services required (all tests self-contained)

## Scenarios

### Priority 1: Fulfillment & Scan Engine

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-01 | Scan barcode - accepted | Endpoints | Critical | Yes |
| EP-02 | Scan barcode - not found | Endpoints | Critical | No |
| EP-03 | Scan barcode - wrong order | Endpoints | Critical | No |
| EP-04 | Scan barcode - already fulfilled | Endpoints | Critical | Yes |
| EP-05 | Scan barcode - out of stock | Endpoints | Critical | Yes |
| EP-06 | Manual fulfill order line | Endpoints | Critical | Yes |
| EP-07 | Undo last scan | Endpoints | Critical | Yes |
| EP-08 | Complete order | Endpoints | Critical | Yes |
| EP-09 | Force complete with admin PIN | Endpoints | Critical | Yes |
| EP-10 | Reset order with admin PIN | Endpoints | Critical | Yes |
| EP-11 | Get fulfillment events | Endpoints | High | No |
| DB-01 | Concurrent scans don't double-decrement | Database | Critical | Yes |
| DB-02 | Transaction rollback on scan failure | Database | Critical | Yes |
| DB-03 | Concurrent undo operations safety | Database | Critical | Yes |
| DB-04 | FulfillmentEvent chain integrity | Database | High | Yes |
| SR-01 | SaleClosed blocks scan/undo/manual-fulfill | Spec Req | Critical | No |

### Priority 2: Walk-Up Orders & Inventory Protection

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-12 | Create walk-up order | Endpoints | High | Yes |
| EP-13 | Add line to walk-up order | Endpoints | High | Yes |
| EP-14 | Update walk-up order line | Endpoints | High | Yes |
| EP-15 | Get walk-up availability | Endpoints | High | No |
| DB-05 | Walk-up inventory protection calculation | Database | Critical | Yes |
| SR-02 | AvailableForWalkup = OnHand - PreorderRemaining | Spec Req | Critical | No |

### Priority 3: Orders CRUD & Line Items

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-16 | List orders with filters | Endpoints | Medium | No |
| EP-17 | Get order by ID with lines | Endpoints | Medium | No |
| EP-18 | Create order with line items | Endpoints | High | Yes |
| EP-19 | Update order metadata | Endpoints | Medium | Yes |
| EP-20 | Delete order (soft delete) | Endpoints | Medium | Yes |
| EP-21 | Add order line | Endpoints | Medium | Yes |
| EP-22 | Update order line | Endpoints | Medium | Yes |
| EP-23 | Delete order line | Endpoints | Medium | Yes |
| DB-06 | Order line qty can't reduce below fulfilled | Database | High | Yes |

### Priority 4: Plants CRUD

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-24 | List plants with search | Endpoints | Medium | No |
| EP-25 | Get plant by ID | Endpoints | Medium | No |
| EP-26 | Create plant (auto-creates inventory) | Endpoints | Medium | Yes |
| EP-27 | Update plant | Endpoints | Medium | Yes |
| EP-28 | Delete plant (soft delete) | Endpoints | Medium | Yes |

### Priority 5: Customers CRUD

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-29 | List customers with search | Endpoints | Medium | No |
| EP-30 | Get customer by ID | Endpoints | Medium | No |
| EP-31 | Create customer | Endpoints | Medium | Yes |
| EP-32 | Update customer | Endpoints | Medium | Yes |
| EP-33 | Delete customer (soft delete) | Endpoints | Medium | Yes |

### Priority 6: Sellers CRUD

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-34 | List sellers with search | Endpoints | Medium | No |
| EP-35 | Get seller by ID | Endpoints | Medium | No |
| EP-36 | Create seller | Endpoints | Medium | Yes |
| EP-37 | Update seller | Endpoints | Medium | Yes |
| EP-38 | Delete seller (soft delete) | Endpoints | Medium | Yes |

### Priority 7: Inventory Management

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-39 | List inventory | Endpoints | Medium | No |
| EP-40 | Set inventory absolute quantity | Endpoints | High | Yes |
| EP-41 | Adjust inventory by delta | Endpoints | High | Yes |
| DB-07 | Inventory adjustment creates audit trail | Database | High | Yes |

### Priority 8: Import System

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-42 | Import plants from CSV/Excel | Endpoints | Medium | Yes |
| EP-43 | Import inventory from CSV/Excel | Endpoints | Medium | Yes |
| EP-44 | Import orders from CSV/Excel | Endpoints | Medium | Yes |
| EP-45 | Get import batches | Endpoints | Low | No |
| EP-46 | Get batch issues | Endpoints | Low | No |
| DB-08 | Import batch atomic save with error tracking | Database | Medium | Yes |

### Priority 9: Reports & Settings

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| EP-47 | Dashboard metrics | Endpoints | Low | No |
| EP-48 | Low inventory report | Endpoints | Low | No |
| EP-49 | Problem orders report | Endpoints | Low | No |
| EP-50 | Seller orders report | Endpoints | Low | No |
| EP-51 | Get settings | Endpoints | Low | No |
| EP-52 | Toggle sale closed with admin PIN | Endpoints | Medium | Yes |
| EP-53 | Get admin actions | Endpoints | Low | No |
| EP-54 | Get API version | Endpoints | Low | No |

### Priority 10: Cross-Cutting & Spec Requirements

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| SR-03 | Response envelope on all endpoints | Spec Req | High | No |
| SR-04 | Admin PIN validation with headers | Spec Req | High | No |
| SR-05 | Pagination defaults and limits | Spec Req | Medium | No |
| SR-06 | Soft delete excludes from default queries | Spec Req | Medium | No |
| SR-07 | IgnoreQueryFilters includes deleted records | Spec Req | Medium | No |
| DB-09 | Soft delete global filter enforcement | Database | Medium | No |
| DB-10 | IgnoreQueryFilters returns deleted records | Database | Medium | No |

### Priority 11: UI Pages

| ID | Title | Area | Priority | Sequential |
|----|-------|------|----------|------------|
| UI-01 | Orders list page renders with search/pagination | UI | Medium | No |
| UI-02 | Order detail page displays order with lines | UI | Medium | No |
| UI-03 | New order page - create order flow | UI | High | Yes |
| UI-04 | Customer list page with A-Z tabs | UI | Medium | No |
| UI-05 | Customer detail page - edit and save | UI | Medium | Yes |
| UI-06 | Plants list page with search | UI | Medium | No |
| UI-07 | Plant detail page - create/edit form | UI | Medium | Yes |
| UI-08 | Sellers list page with A-Z tabs | UI | Medium | No |
| UI-09 | Seller detail page - edit | UI | Medium | Yes |
| UI-10 | Inventory page inline edit | UI | Medium | Yes |
| UI-11 | Inventory adjust modal | UI | Medium | Yes |
| UI-12 | Pickup lookup page - find customer | UI | High | No |
| UI-13 | Pickup scan page - barcode scanning flow | UI | Critical | Yes |
| UI-14 | Pickup scan - undo last scan | UI | High | Yes |
| UI-15 | Pickup scan - manual fulfill modal | UI | High | Yes |
| UI-16 | Pickup scan - force complete with admin PIN | UI | High | Yes |
| UI-17 | Walk-up new order page | UI | High | Yes |
| UI-18 | Walk-up availability display | UI | Medium | No |
| UI-19 | Imports page - file upload | UI | Medium | Yes |
| UI-20 | Imports page - import history | UI | Low | No |
| UI-21 | Station home page navigation | UI | Low | No |
| UI-22 | Settings page - sale closed toggle | UI | Medium | Yes |
| UI-23 | Dashboard page renders metrics | UI | Low | No |
| UI-24 | Print plant labels page | UI | Low | No |
| UI-25 | Print order page | UI | Low | No |
| UI-26 | Admin PIN modal interaction | UI | High | No |
| UI-27 | Confirm modal interaction | UI | Medium | No |
| UI-28 | Global quick find overlay | UI | Low | No |

## Holdout Scenarios

97 scenarios are stored as holdouts in `.holdout/`. These are invisible to agents during `/forge-run` and only evaluated by `/forge-test-run`.

## Coverage Summary
- Total scenarios: 97
- Endpoints covered: 54/47 (some endpoints have multiple scenarios)
- UI components covered: 28/30
- Database operations covered: 10/12
- Spec requirements covered: 7
- Sequential scenarios: 63 (must run in order due to state mutations)

## Execution
```bash
cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet
```
