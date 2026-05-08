---
title: Sale-Day Test Fixtures
audience: sale-day supervisor / QA
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-03-camera-scanner-foundation-design.md
  - docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md
  - docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md
---

# Sale-Day Test Fixtures

Synthetic test data for the morning-of drill, the device-readiness pass, and
the smoke test plan. **All values below are disposable / dev-only.** None of
them is a real customer order or a real plant SKU. Do not encode production
data onto a printed label.

## Scanner-level fixtures

The scanner foundation already ships its own fixtures, defined at:

- `docs/tests/scanner-fixtures.md`

Those cover: QR codes, Code 128 barcodes, UPC-A / EAN-13, the deliberately
unknown payload, the duplicate-scan cooldown, the manual-entry path, and
the visibility / tab-switch path. **Use that file** for verifying the
scanner mechanic itself.

This file (`fixtures.md`) layers on top: it provides **manual-entry test
order numbers** and **expected workflow outcomes** for the higher-level
pickup and lookup workflows.

## Workflow fixtures (manual entry)

These five fixtures exercise the manual-entry path on `/mobile/lookup` and
`/mobile/pickup`. Seed them in the dev database (or use a sale-day-eve
"dress rehearsal" environment with disposable orders). **Disposable / dev
only.**

| # | Order number | Customer name | Expected status | Test path |
|---|--------------|---------------|-----------------|-----------|
| 1 | `HHPS-TEST-0001` | Customer Bloggs | Open, 3 lines, 0 fulfilled | Lookup -> exact match -> Pickup-Scan |
| 2 | `HHPS-TEST-0002` | Customer Tester | Partially fulfilled (1 of 2 lines) | Pickup-Scan resume |
| 3 | `HHPS-TEST-0003` | Customer Volunteer A | Already fully fulfilled | Lookup-only verification |
| 4 | `HHPS-TEST-0004` | Customer Volunteer B | Cancelled | Should display cancelled banner |
| 5 | `HHPS-TEST-0005` | -- (does not exist) | 404 | "Order not found" path |

### Fixture 1 -- Happy path

- Volunteer enters `HHPS-TEST-0001` on the lookup page.
- App navigates to the order detail.
- Volunteer taps **Start scan** to open the pickup-scan page.
- Volunteer fulfills each line.
- **Success looks like:** Each line check-blooms gold, the order status flips
  to **Fulfilled**, the stamp animation runs, and the audit log records each
  fulfillment with `source: mobile-camera` (or `manual-entry` if entered by
  hand).
- **Failure looks like:** Any line stuck on Searching... after a successful
  decode, OR the status pill stays red, OR the order remains **Open** after
  all lines visibly check-bloom.

### Fixture 2 -- Resume mid-fulfillment

- Volunteer enters `HHPS-TEST-0002`.
- App opens directly to a partially-completed pickup state.
- **Success looks like:** Already-fulfilled lines display the gold check
  bloom on first paint (not animated -- already-stamped state), and the
  remaining lines are interactive.
- **Failure looks like:** Already-fulfilled lines re-trigger the bloom
  animation on every visit (visual regression), or the volunteer can
  re-fulfill a line (P0 -- backend should reject, but UI should also
  refuse to re-submit).

### Fixture 3 -- Already fulfilled

- Volunteer enters `HHPS-TEST-0003`.
- App opens to the order detail and shows **Fulfilled** status.
- **Success looks like:** Pickup-scan button is either hidden or labelled
  "View only", and any attempt to scan returns "Already fulfilled" without
  side effects.
- **Failure looks like:** Volunteer can re-fulfill, or the inventory ticks
  down a second time.

### Fixture 4 -- Cancelled order

- Volunteer enters `HHPS-TEST-0004`.
- App displays a **Cancelled** banner / stamp.
- **Success looks like:** No scan UI is reachable for this order. Lookup is
  read-only.
- **Failure looks like:** Scan UI is reachable, OR the cancellation is not
  visually flagged.

### Fixture 5 -- Not found

- Volunteer enters `HHPS-TEST-0005`.
- App stays on the lookup page and shows the not-found state (the seed
  empty-state illustration with "We could not find an order with that
  number" copy).
- **Success looks like:** Empty state visible, no console errors, no
  navigation.
- **Failure looks like:** Spinner stuck, or the app navigates to a blank
  detail page.

## How to seed these fixtures

`<TBD admin tooling>` -- the user-management plan has not yet decided
whether sale-day fixtures get a dedicated `seed-fixtures` admin script or
are seeded by hand via the existing CSV import endpoints. Until that is
decided:

1. Use the existing `POST /api/orders` endpoint to create the five orders
   above with the listed customer names.
2. For fixture 2, fulfill one line via the API.
3. For fixture 3, fulfill all lines.
4. For fixture 4, cancel via the orders admin UI.
5. Fixture 5 must NOT exist -- skip seeding it.

## Cleanup

After the dress rehearsal:

- [ ] Soft-delete or mark-cancelled all `HHPS-TEST-*` orders.
- [ ] Confirm no fixture order numbers appear in the day-of report.

## Related

- `docs/tests/scanner-fixtures.md` -- scanner-mechanic fixtures (do not duplicate).
- `fallback-playbook.md` -- what to do when the workflow misbehaves.
- `morning-of-checklist.md` -- the day-of execution of these fixtures.
