# Audit & Troubleshooting Guide

This guide helps supervisors answer the core audit question for any scan event: **who did it, how, when, on which order, and what was the outcome?**

---

## Audit Surfaces in This Repo

### 1. `fulfillment_events` Table (Primary Scan Audit Log)

Every barcode scan — accepted or rejected — is recorded as a `FulfillmentEvent` row. Key columns:

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID | Unique event identifier |
| `order_id` | UUID | Which order the scan was processed against |
| `plant_catalog_id` | UUID (nullable) | Plant looked up (null if barcode not found) |
| `barcode` | text | Raw barcode value scanned or entered |
| `result` | enum | Outcome — see Result Categories below |
| `quantity` | int | Units affected (default 1; multi-qty scans record one row) |
| `message` | text (nullable) | Human-readable detail for non-accepted outcomes |
| `created_at` | timestamptz | Timestamp of the scan (UTC) |

> **Note on actor/source:** The current model records the order and barcode but does not store a per-event `UserId` or `ScanSource` (camera vs. manual-entry) column. A device-level volunteer assignment is recorded through account/role setup ([04-account-role-setup.md](./04-account-role-setup.md)). If per-scan user attribution is needed in the future, add a `VolunteerId` FK and `ScanSource` enum column to `FulfillmentEvent` in a follow-up migration. A backlog item for this is referenced in [08-hardening-verification.md](./08-hardening-verification.md).

#### Result Categories (REQ-008)

| `FulfillmentResult` value | Meaning |
|---|---|
| `Accepted` | Plant assigned to order; inventory decremented |
| `NotFound` | Barcode not in catalog |
| `WrongOrder` | Plant exists but belongs to a different order |
| `AlreadyFulfilled` | Plant already scanned/fulfilled on this order |
| `SaleClosedBlocked` | Scan attempted after sale close |
| `OutOfStock` | No remaining walk-up inventory |

---

### 2. `GET /api/admin-actions` (Admin PIN Override Log)

All supervisor overrides (fulfilled via Admin PIN) are logged through `AdminActionsController`. Use this endpoint to list override events with their recorded reason.

**Request:**

```http
GET /api/admin-actions
X-Admin-Pin: <supervisor PIN>
X-Admin-Reason: audit review
```

**Response envelope:** `ApiResponse<T>` — `{ success, data, errors }` — standard project format.

---

### 3. Representative Audit Query Against `fulfillment_events`

Use this read-only query to retrieve all scan events for a specific order, ordered by time:

```sql
SELECT
    fe.id,
    fe.order_id,
    fe.barcode,
    fe.plant_catalog_id,
    pc.name         AS plant_name,
    fe.result,
    fe.quantity,
    fe.message,
    fe.created_at
FROM fulfillment_events fe
LEFT JOIN plant_catalog pc ON pc.id = fe.plant_catalog_id
WHERE fe.order_id = '<ORDER_UUID>'
  AND fe.deleted_at IS NULL
ORDER BY fe.created_at ASC;
```

Replace `<ORDER_UUID>` with the order ID from the customer's receipt or the admin UI.

To view **all** events for a time window (e.g., the last hour):

```sql
SELECT *
FROM fulfillment_events
WHERE created_at >= NOW() - INTERVAL '1 hour'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

---

## Troubleshooting Common Scenarios

### Scan recorded as `WrongOrder`

1. Confirm the volunteer opened the correct customer order before scanning.
2. Query `fulfillment_events` with `WHERE barcode = '<scanned_value>'` to see which order the plant is actually assigned to.
3. If the plant needs to be moved, use an Admin PIN override and record the reason.

### Scan not appearing in audit log

1. Check the volunteer device's network connection — scan results require a live API call (`/api/fulfillment`).
2. Confirm the device's clock is within a few minutes of UTC (NTP sync).
3. If the scan appeared to succeed on screen but no row exists, check the API error log (Serilog structured logs) for the relevant timestamp.

### Duplicate `AlreadyFulfilled` scans

These are expected and benign if a volunteer accidentally re-scans. Each attempt creates its own audit row with `AlreadyFulfilled`. No inventory is double-decremented.

### Walk-up scan blocked by `OutOfStock`

Means `AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)` reached zero. Supervisor can verify live inventory via the admin plant detail page or a direct DB query on `plant_catalog.on_hand_qty`.

---

## Out of Scope for This Spec

A phone-friendly mobile audit page (`/mobile/audit` or similar) that lets volunteers self-serve scan history is explicitly **not** included in this spec. If a phone-friendly audit view is wanted, raise a separate backlog item. Supervisors who need real-time audit access on sale day should use the desktop admin UI at a supervisor station or connect directly to the database.
