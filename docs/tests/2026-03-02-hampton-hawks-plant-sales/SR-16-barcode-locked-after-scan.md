---
scenario_id: "SR-16"
title: "Barcode is locked after first successful scan and accept"
tool: "bash"
type: test-scenario
sequential: true
tags:
  - test-scenario
---

# Scenario SR-16: Barcode is locked after first successful scan and accept

## Description
Verifies that a plant's barcodeLockedAt field is null before any scan and is set to a timestamp after the barcode is scanned and accepted for the first time.

## Preconditions
- Docker Compose running
- API available at http://localhost:8080
- Steps must be executed in order (sequential: true)

## Steps
1. Create a plant via POST /api/plants with a unique barcode value; do not set barcodeLockedAt.
2. GET /api/plants/{id} and confirm `barcodeLockedAt` is null.
3. Create a customer and an order with a line for that plant via POST /api/customers, POST /api/orders, and POST /api/orders/{id}/lines.
4. Perform a barcode scan via the appropriate scan endpoint (e.g., POST /api/scan or POST /api/pickup/scan) using the plant's barcode.
5. Accept the scan result (if a two-step accept is required, POST the accept endpoint).
6. GET /api/plants/{id} and verify `barcodeLockedAt` is now set to a non-null ISO 8601 timestamp.

## Expected Results
- Step 2 shows `barcodeLockedAt: null`.
- Step 4 or 5 returns HTTP 200 with `{ success: true, data: { ... } }`.
- Step 6 shows `barcodeLockedAt` is a valid ISO 8601 datetime string (not null).

## Execution Tool
bash -- use curl; use jq `.data.barcodeLockedAt` to assert the field before and after scanning.

## Pass / Fail Criteria
- **Pass:** barcodeLockedAt is null before the scan and is set to a non-null timestamp after the scan is accepted.
- **Fail:** barcodeLockedAt remains null after the scan, or is pre-populated before any scan occurs.
