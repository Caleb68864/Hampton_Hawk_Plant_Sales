---
title: "Fix: Concurrent Scan Race Condition"
project: "Hampton Hawks Plant Sales"
date: 2026-03-02
type: spec
severity: critical
failing_scenarios: [DB-01]
tags:
  - fix
  - concurrency
  - critical
---

# Fix: Concurrent Scan Race Condition

## Meta
- Project: Hampton Hawks Plant Sales
- Date: 2026-03-02
- Author: Forge
- Severity: CRITICAL
- Failing Scenarios: DB-01

## Outcome
Concurrent scan requests against the same order cannot double-accept the same order line. Inventory decrements are atomic and consistent. Two simultaneous scans for a plant with qty=2 result in exactly 2 inventory decrements and 2 fulfilled lines, not 1.

## Context
When two scan requests arrive simultaneously for the same barcode and order, both read the same order line state (qtyFulfilled=0), both accept, but inventory only decrements once. This leaves the order in an inconsistent state with one unfulfilled line that cannot be scanned again.

The `FulfillmentService` needs transaction isolation and/or row-level locking on the order line and inventory records during scan processing.

## Requirements
- Wrap scan processing in a serializable transaction or use `SELECT ... FOR UPDATE` (PostgreSQL row-level locking) on the order line and inventory record
- Two concurrent scans for the same order+barcode must not both succeed on the same line
- Final inventory must be consistent: if 2 units are consumed, inventory decrements by exactly 2
- No 500 errors from concurrency conflicts -- handle `DbUpdateConcurrencyException` gracefully with retry or appropriate error response

## Sub-Specs

### 1. Add Transaction Isolation to Scan Processing
**Scope:** Wrap the scan fulfillment logic in a transaction with appropriate isolation level.
**Files likely touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/FulfillmentService.cs`
- Possibly `api/src/HamptonHawksPlantSales.Infrastructure/Data/AppDbContext.cs` for transaction helpers
**Acceptance criteria:**
- Two parallel scan requests for the same barcode+order with inventory=2 result in inventory=0 (not 1)
- Both scan responses are valid (no 500 errors)
- The order has exactly 2 fulfilled lines or events
- Sequential scans continue to work as before
**Dependencies:** none

## Edge Cases
- Three+ concurrent scans should also be safe
- Scans against different orders in parallel should not block each other unnecessarily

## Verification
- Re-run: `/forge-test-run docs/tests/2026-03-02-hampton-hawks-plant-sales/test-plan.md --scenario DB-01`
