---
title: Sale-Day Audit Guide
audience: sale-day supervisor / admin / post-sale auditor
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-04-mobile-pickup-scan-workflow-design.md
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Sale-Day Audit Guide

Where to look for what happened during the sale -- which orders were
fulfilled, when, by whom, via what channel, and what (if anything) failed.
This document is for the supervisor on sale day and the admin doing
post-sale reconciliation.

## What gets recorded

Two backend tables carry the audit truth:

| Table | What it captures |
|-------|------------------|
| `FulfillmentEvent` | One row per scan / fulfill / undo on an order line: order, plant, barcode, result enum, quantity, message, timestamp. |
| `AdminAction` | One row per admin-PIN action: action type, entity, reason (operator-supplied), timestamp. |

### FulfillmentEvent fields (today)

```
Id              Guid
OrderId         Guid
PlantCatalogId  Guid?
Barcode         string
Result          enum (Accepted, Rejected, AlreadyFulfilled, ...)
Quantity        int
Message         string?
CreatedAt       DateTimeOffset
DeletedAt       DateTimeOffset?
```

### AdminAction fields

```
Id          Guid
ActionType  string  -- "ForceComplete", "Reset", etc.
EntityType  string  -- "Order", "Inventory", ...
EntityId    Guid
Reason      string  -- supplied via X-Admin-Reason header
Message     string?
CreatedAt   DateTimeOffset
```

## Known gaps -- read this first

`FulfillmentEvent` does **not** currently carry:

- A user ID (which volunteer performed the scan).
- A source flag (camera vs manual entry vs paper-recon).
- A station / device identifier.

This is a known shortfall and is tracked as a backlog item by the
hardening pass (see `hardening-checklist.md` -> "Fulfillment audit
attribution"). Until that lands, the sale-day audit story is:

- **Who:** infer from station + time, using the volunteer assignment
  sheet (paper, supervisor table) and the manual fulfillment log if
  paper backup was used.
- **Source:** infer from `console.debug` telemetry the operator
  captured (see "Browser console telemetry" below) OR record
  `<surface TBD>` in the post-sale report and follow up.
- **Station / device:** `<surface TBD>` -- no backend record today.

`AdminAction` *does* carry the operator-supplied reason on every admin
override, so force-complete events have a richer trail than regular
scans. That asymmetry is intentional: admin overrides bypass safety
nets and so deserve more audit detail.

## How to answer common audit questions

### "Was this order fulfilled? When?"

1. Open the admin web app on the laptop.
2. Navigate to the order detail.
3. Read the fulfillment events list (`<surface TBD>` -- exact route
   depends on the admin UI; the underlying API is
   `GET /api/orders/{id}/fulfillment-events`).
4. Look at the most recent `Accepted` event for each line. The order
   is **fully fulfilled** when every line has a matching accepted event
   summing to its `qtyOrdered`.

### "Did anything get rejected?"

1. Same surface as above.
2. Filter events by `Result != Accepted`.
3. Each non-accepted event has a `Message` field explaining why
   (`AlreadyFulfilled`, `WrongOrder`, etc.).

### "Did an admin force-complete this?"

1. Open `AdminAction` log (`<surface TBD>` -- ops to confirm whether the
   admin web app exposes this list directly or whether the auditor
   queries the API at `GET /api/admin-actions`).
2. Filter `EntityType=Order, EntityId=<order id>`.
3. The `Reason` field is the operator's free-text explanation.

### "Who scanned this?"

**Today:** not directly answerable from the backend. The cross-reference
is:

1. Note the `CreatedAt` timestamp of the fulfillment event.
2. Match against the volunteer assignment sheet (paper) for that hour
   and station.
3. Confirm with the volunteer if a question remains.

Until per-event user attribution lands, this is the documented procedure.

### "Was it a camera scan or a manual entry?"

**Today:** also not directly answerable from `FulfillmentEvent`. The
mobile UI records the source on `console.debug` for the volunteer's own
session (see below) but that telemetry is local to the device and is
gone when the tab closes.

The post-sale procedure: assume any fulfillment that happened during
the paper-backup window was manual or paper-recon (see
`print-and-paper-backup.md`); everything else was either camera or
manual via the mobile shell. The breakdown is `<surface TBD>` until
backend attribution lands.

## Browser console telemetry (operator-only)

The mobile shell emits `console.debug` lines on every scan / lookup.
The lines are **not** stored anywhere -- they only exist as long as
the developer console is open.

Useful to capture:

- `mobile-pickup-scan` -- emitted from `MobilePickupScanPage.tsx` and
  `MobilePickupLookupPage.tsx`. Carries source, code (truncated),
  scannedAtUtc.
- `mobile-lookup-scan` -- emitted from `MobileOrderLookupPage.tsx`.
  Same shape.

If a supervisor is debugging a specific phone live during the sale
(e.g., a station reports phantom rejections), they can:

1. On the laptop, plug the phone in via USB.
2. Open Safari (Mac) or Chrome (any) developer tools and select the
   phone's tab.
3. Watch the **Console** tab while the volunteer reproduces the issue.
4. Filter on `mobile-pickup-scan` or `mobile-lookup-scan`.

Important: these logs **do not include order numbers in plaintext**
(see `hardening-checklist.md` -> "no PII in console"). They include
scan source and timestamp; that is the supported telemetry surface.

## Post-sale checklist

- [ ] Export the `FulfillmentEvent` rows for the sale-day window.
- [ ] Export the `AdminAction` rows for the sale-day window.
- [ ] Reconcile against the manual fulfillment log (if paper backup
      was used).
- [ ] Confirm every Order with status `Open` or `Partial` is intentional
      (e.g., customer never showed up) -- not a missed fulfillment.
- [ ] Archive the paper logs alongside the digital export.

## Related

- `accounts-and-roles.md` -- which station = which account.
- `print-and-paper-backup.md` -- what the paper log looks like.
- `hardening-checklist.md` -- the audit-attribution backlog item.
- `fallback-playbook.md` -- when audit gaps will be most painful.
