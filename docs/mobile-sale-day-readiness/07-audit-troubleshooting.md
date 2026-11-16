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
| `UserId` | UUID (nullable) | Signed-in account (`AppUsers.Id`) that made the request. Sale-day accounts are per station (`Pickup1`, `POS2`, ...), so this names the station login, not the person holding the phone. Not a foreign key, so it survives the account being deleted. Null on rows from before migration `AddFulfillmentEventAttribution` (2026-11-16) |
| `Source` | text (nullable) | Server write path: `PickupScan`, `SessionScan`, `ManualFulfill` or `Undo`. Null on older rows |
| `created_at` | timestamptz | Timestamp of the scan (UTC) |

> **Note on actor/source:** Since 2026-11-16 each event records the station account (`UserId`) and the write path (`Source`). It still does not record the *input method* (camera vs. keyboard-wedge scanner vs. typed SKU) or the person behind a shared account; see "Fulfillment event attribution: open questions" in `docs/ROADMAP.md`. Walk-up register sales write `WalkUpRegisterScans`, not fulfillment events, and are not attributed by this change.

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
    fe."Id",
    fe."OrderId",
    fe."Barcode",
    fe."PlantCatalogId",
    pc."Name"       AS plant_name,
    fe."Result",
    fe."Quantity",
    fe."Message",
    fe."Source",
    u."Username"    AS station_account,
    fe."CreatedAt"
FROM "FulfillmentEvents" fe
LEFT JOIN "PlantCatalogs" pc ON pc."Id" = fe."PlantCatalogId"
LEFT JOIN "AppUsers" u ON u."Id" = fe."UserId"
WHERE fe."OrderId" = '<ORDER_UUID>'
  AND fe."DeletedAt" IS NULL
ORDER BY fe."CreatedAt" ASC;
```

Replace `<ORDER_UUID>` with the order ID from the customer's receipt or the admin UI.

To view **all** events for a time window (e.g., the last hour):

```sql
SELECT *
FROM "FulfillmentEvents"
WHERE "CreatedAt" >= NOW() - INTERVAL '1 hour'
  AND "DeletedAt" IS NULL
ORDER BY "CreatedAt" DESC;
```

(The real tables and columns are PascalCase and must be double-quoted. Before
2026-11-16 this guide used snake_case names, which do not exist.)

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
