# 🌱 Hampton Hawks Plant Sales
## `spec.md` — Production Build Specification (v1.0)

**Branding Footer:** _Powered by Logic NE_ (Nebraska)  
**Framework:** .NET 10 (ASP.NET Core Web API)  
**Frontend:** React + Vite + TypeScript + Tailwind CSS (SPA)  
**Database:** PostgreSQL 16+  
**Deployment:** Docker Compose (single host)  
**Scanning:** Keyboard-wedge scanners (barcode == SKU-level, unique per SKU)  
**Scale Target:** up to 5,000 orders (typically less)  
**Pickup Stations:** 2 concurrent stations  
**Auth:** No user login/roles in v1. Admin override via App PIN only.

---

## 0. The mission
Build a production-ready system for a school plant fundraiser that:

- Imports plant SKUs and inventory counts
- Imports preorders (customers + order lines)
- Supports manual CRUD for **everything**
- Supports walk-up orders **without stealing inventory needed for preorders**
- Provides a fast pickup workflow that uses **keyboard-wedge barcode scanners**
- Produces printable order sheets and cheat sheets
- Provides interactive API docs (Swagger) and UI/component docs (Storybook + TypeDoc)
- Is Docker-hostable with Postgres
- Is joy-to-use at a busy counter

This spec is intended to be a “walk-away” implementation contract: an implementation model should be able to build the complete app from this document without follow-up questions.

---

## 1. Non-negotiable rules (hard constraints)

### 1.1 Barcode semantics
- **Barcode is unique per SKU** (PlantCatalog item).  
- Multiple physical plants of the same SKU share the same barcode.  
- Scanning means “fulfill 1 unit of that SKU” for the active order line.

### 1.2 Scan hard-block
- If a scanned SKU is **not present** on the active order: **hard block**.  
- The user must **edit the order** to add the SKU before it can be fulfilled.  
- There is **no** “auto-add on scan” behavior.

### 1.3 Sale Closed is absolute
When `SaleClosed=true`:
- **No scanning allowed** (even with Admin PIN).
- **No undo allowed** (even with Admin PIN).
- **No manual fulfill allowed** (even with Admin PIN).
- App becomes read-only **except** admin-only non-scan actions:
  - Force complete an order (Admin PIN + reason)
  - Inventory adjustments (Admin PIN + reason)
  - Toggle SaleClosed itself (Admin PIN + reason)

### 1.4 Walk-up inventory protection
Walk-up orders must **not** reduce inventory such that preorders cannot be fulfilled, unless admin override is used.

### 1.5 Soft delete everywhere
- All entities use `DeletedAt` soft delete.
- UI should hide deleted records by default.
- API must exclude soft-deleted records by default.

### 1.6 Two-station concurrency safety
All scan and inventory mutations must be transactional and safe with 2 pickup stations scanning simultaneously.

---

## 2. Tech stack and project structure

### 2.1 Backend
- **.NET 10** Web API
- EF Core (compatible with .NET 10)
- Npgsql provider
- FluentValidation
- Serilog JSON logging
- Swashbuckle Swagger/OpenAPI
- Health checks

### 2.2 Frontend
- React + TypeScript (strict)
- Vite
- Tailwind CSS
- React Router
- Zustand
- Axios (or typed fetch wrapper)
- ESLint + Prettier

### 2.3 Documentation tooling
- Backend: XML docs + Swagger UI
- Frontend: Storybook (interactive components) + TypeDoc (API/docs site)
- In-app: `/docs` help page
- Printable: order sheets + volunteer cheat sheets in HTML

### 2.4 Repository layout (required)
```
/api
  /src/HamptonHawksPlantSales.Api
  /src/HamptonHawksPlantSales.Core
  /src/HamptonHawksPlantSales.Infrastructure
  /tests/HamptonHawksPlantSales.Tests
  Dockerfile
/web
  /src
  /public
  /storybook
  Dockerfile
/docker-compose.yml
/docs
  /cheatsheets
  /frontend/typedoc (generated output)
README.md
```

Notes:
- Business logic MUST NOT live in controllers.
- Controllers call services; services enforce rules; infrastructure handles persistence.

---

## 3. Core workflows

### 3.1 Setup phase
1. Import Plants (SKUs + barcodes + names, etc.)
2. Import Inventory counts (OnHand per SKU)
3. Import Orders (Customers + Seller + line items)
4. Spot-fix issues in UI using CRUD pages (barcodes, names, counts, etc.)

### 3.2 Pickup phase (Sale Open)
1. Volunteer finds order by customer/seller/order #/pickup code
2. Open pickup screen for an order
3. Scan plant barcodes (keyboard wedge → input text + Enter)
4. App marks items fulfilled and decrements inventory
5. Partial pickups are allowed across multiple days (while sale open)
6. Complete order when all lines fulfilled (or admin force complete if needed)

### 3.3 Sale close phase
1. Admin toggles Sale Closed
2. App becomes scan-locked and effectively read-only
3. Admin can still adjust inventory and force-complete if needed

---

## 4. Data model (Postgres)

### 4.0 Conventions
- Primary keys: UUID
- Timestamps: `timestamptz`
- Soft delete: `DeletedAt timestamptz null`
- All tables include `CreatedAt` and `UpdatedAt` except where noted (events and issues may only need CreatedAt).

### 4.1 AppSettings (single-row)
```text
AppSettings
-----------
Id (uuid, PK)  -- single row
SaleClosed (bool) default false
SaleClosedAt (timestamptz null)
CreatedAt
UpdatedAt
DeletedAt
```

### 4.2 PlantCatalog
```text
PlantCatalog
------------
Id (uuid, PK)
Sku (text, unique, required, indexed)
Name (text, required)
Variant (text null)
Price (numeric(10,2) null)
Barcode (text, unique, required, indexed)   -- barcode == SKU-level barcode
BarcodeLockedAt (timestamptz null)
IsActive (bool) default true
CreatedAt
UpdatedAt
DeletedAt
```

**Barcode lock trigger:** first successful Accepted scan for this SKU sets `BarcodeLockedAt` if null.

### 4.3 Inventory (1:1 with PlantCatalog)
```text
Inventory
---------
Id (uuid, PK)
PlantCatalogId (uuid, FK -> PlantCatalog.Id, unique, indexed)
OnHandQty (int, required)
CreatedAt
UpdatedAt
DeletedAt
```

### 4.4 InventoryAdjustment
```text
InventoryAdjustment
-------------------
Id (uuid, PK)
PlantCatalogId (uuid, FK, indexed)
DeltaQty (int, required)         -- +/-
Reason (text, required)
Notes (text null)
CreatedAt
DeletedAt
```

### 4.5 Seller (student)
```text
Seller
------
Id (uuid, PK)
FirstName (text null)
LastName (text null, indexed)
DisplayName (text, required, indexed)
Grade (text null)
Teacher (text null)
Notes (text null)
CreatedAt
UpdatedAt
DeletedAt
```

### 4.6 Customer
```text
Customer
--------
Id (uuid, PK)
FirstName (text null)
LastName (text null, indexed)
DisplayName (text, required, indexed)
Phone (text null, indexed)
Email (text null)
PickupCode (text, unique, required, indexed)   -- auto-generated
Notes (text null)
CreatedAt
UpdatedAt
DeletedAt
```

### 4.7 Order
```text
Order
-----
Id (uuid, PK)
CustomerId (uuid, FK, indexed)
SellerId (uuid, FK nullable, indexed)          -- exactly one seller max
OrderNumber (text, unique, required, indexed)  -- auto-generated for manual
Status (enum: Open, InProgress, Complete, Cancelled)
IsWalkUp (bool) default false
HasIssue (bool) default false
CreatedAt
UpdatedAt
DeletedAt
```

### 4.8 OrderLine
```text
OrderLine
---------
Id (uuid, PK)
OrderId (uuid, FK, indexed)
PlantCatalogId (uuid, FK, indexed)
QtyOrdered (int, required)
QtyFulfilled (int, required) default 0
Notes (text null)
CreatedAt
UpdatedAt
DeletedAt
```

**Invariants:**
- `QtyOrdered >= 0`
- `QtyFulfilled >= 0`
- `QtyFulfilled <= QtyOrdered` (enforced in service layer; DB CHECK constraint recommended)

### 4.9 FulfillmentEvent
```text
FulfillmentEvent
----------------
Id (uuid, PK)
OrderId (uuid, FK, indexed)
PlantCatalogId (uuid, FK null, indexed)   -- null when barcode not found
Barcode (text, required)
Result (enum: Accepted, NotFound, WrongOrder, AlreadyFulfilled, SaleClosedBlocked, OutOfStock)
Message (text null)
CreatedAt (timestamptz, required)
DeletedAt (timestamptz null)
```

Notes:
- Every scan attempt produces an event.
- Manual fulfill produces an event.
- Undo produces a referencing event (see section 8).

### 4.10 ImportBatch / ImportIssue
```text
ImportBatch
-----------
Id (uuid, PK)
Type (enum: Plants, Orders, Inventory)
Filename (text)
TotalRows (int)
ImportedCount (int)
SkippedCount (int)
CreatedAt
DeletedAt

ImportIssue
-----------
Id (uuid, PK)
ImportBatchId (uuid, FK, indexed)
RowNumber (int)
IssueType (text)          -- e.g. DuplicateBarcode, MissingSku, UnknownSku, BadQuantity
Barcode (text null)
Sku (text null)
Message (text)
RawData (jsonb)
CreatedAt
DeletedAt
```

### 4.11 AdminAction
```text
AdminAction
-----------
Id (uuid, PK)
ActionType (text)         -- ForceCompleteOrder, EditLockedBarcode, OverrideOrderEdit, AdjustInventory, ToggleSaleClosed, ResetOrder, WalkupOverrideInventory
EntityType (text)         -- Order, PlantCatalog, Inventory, etc.
EntityId (uuid)
Reason (text, required)
Message (text null)
CreatedAt
DeletedAt
```

---

## 5. Critical business rules (detailed)

### 5.1 Sale Closed logic (absolute)
When `AppSettings.SaleClosed = true`:
- **Scan endpoint**: always blocked → create `FulfillmentEvent(SaleClosedBlocked)`
- **Undo endpoint**: always blocked (even with admin)
- **Manual fulfill**: always blocked (even with admin)
- **Create/edit orders/lines/inventory**: blocked unless admin override (except read endpoints)

Additionally:
- The UI should show a persistent banner: “SALE CLOSED: scanning disabled.”

### 5.2 Walk-up protection math
Definitions:
- Preorder orders are orders where `IsWalkUp=false` and `Status != Cancelled` and not deleted.
- For each SKU (PlantCatalogId):

```
PreorderRemaining = SUM(OrderLine.QtyOrdered - OrderLine.QtyFulfilled) across preorder orders
AvailableForWalkup = Inventory.OnHandQty - PreorderRemaining
```

Rules:
- When adding/increasing walk-up line items:
  - if requested qty > AvailableForWalkup → block with error
  - admin override can bypass → log AdminAction and set `Order.HasIssue=true`

### 5.3 Scan rules (SKU-level)
On scan for orderId:

1) If SaleClosed → block, event SaleClosedBlocked
2) Normalize barcode: trim, preserve exact characters (no forced uppercase unless you commit to it everywhere)
3) Lookup PlantCatalog by Barcode
   - if not found → event NotFound
4) Find OrderLine for PlantCatalogId
   - if none → event WrongOrder (hard block)
5) If QtyFulfilled >= QtyOrdered → event AlreadyFulfilled
6) If Inventory.OnHandQty <= 0 → event OutOfStock
7) Else → Accepted scan:
   - transactionally:
     - lock Inventory row `FOR UPDATE`
     - lock OrderLine row `FOR UPDATE`
     - re-check conditions
     - decrement inventory, increment fulfilled
     - insert FulfillmentEvent(Accepted)
     - set BarcodeLockedAt if null

### 5.4 Undo rules (restores inventory)
Undo reverses the most recent Accepted scan for the order.

- Only reverses **Accepted** events.
- Transactionally:
  - QtyFulfilled -= 1
  - OnHandQty += 1
  - Create a new FulfillmentEvent documenting the undo

Undo is:
- Allowed only when SaleClosed=false.
- Not admin gated; any operator can undo during sale open.

### 5.5 Completion rules
Normal completion:
- Allowed only when all lines satisfy `QtyFulfilled == QtyOrdered`

Admin forced completion:
- Allowed only with Admin PIN + reason.
- Logs AdminAction with remaining unfulfilled summary.
- Inserts FulfillmentEvent noting force complete.

SaleClosed interaction:
- Force complete may be allowed as admin-only write even when SaleClosed=true.
- But scanning/undo/manual fulfill remain blocked.

### 5.6 Barcode editing lock
- If `BarcodeLockedAt is not null`, barcode edit requires admin PIN + reason.
- Must log AdminAction with old/new barcode value.

### 5.7 Order edit protection
For InProgress/Complete:
- cannot reduce QtyOrdered below QtyFulfilled
- cannot delete fulfilled lines (QtyFulfilled > 0)
- cannot change PlantCatalogId on fulfilled lines
Admin override can permit edits that still preserve invariants (never allow QtyFulfilled > QtyOrdered). Must log AdminAction.

---

## 6. Concurrency and transaction safety (2 stations)

### 6.1 Required database locking strategy
For scan and undo operations, use a transaction + row locks.

**Scan transaction (pseudo SQL):**
```sql
BEGIN;

-- lock inventory row
SELECT * FROM "Inventory"
WHERE "PlantCatalogId" = @plantId AND "DeletedAt" IS NULL
FOR UPDATE;

-- lock order line row
SELECT * FROM "OrderLine"
WHERE "OrderId" = @orderId AND "PlantCatalogId" = @plantId AND "DeletedAt" IS NULL
FOR UPDATE;

-- re-check conditions then update
UPDATE "Inventory" SET "OnHandQty" = "OnHandQty" - 1, "UpdatedAt" = NOW()
WHERE "PlantCatalogId" = @plantId;

UPDATE "OrderLine" SET "QtyFulfilled" = "QtyFulfilled" + 1, "UpdatedAt" = NOW()
WHERE "Id" = @orderLineId;

INSERT INTO "FulfillmentEvent" (...) VALUES (...);

COMMIT;
```

**Undo transaction mirrors scan** with opposite increments/decrements.

### 6.2 Idempotency notes
- Scans are not strictly idempotent (each accepted scan changes counts).
- However, duplicates should be protected by frontend debounce and server validation (AlreadyFulfilled or OutOfStock as needed).

---

## 7. Admin PIN and override protocol

### 7.1 Storage
Admin PIN is provided via environment variable:
- `APP_ADMIN_PIN`

### 7.2 Headers
All admin-required endpoints/actions must accept:
- `X-Admin-Pin: <pin>`
- `X-Admin-Reason: <reason>` (required and non-empty)

If admin headers are missing/invalid:
- return HTTP 403 and an error message.

### 7.3 Admin-only actions list (must be enforced)
- Toggle SaleClosed
- Force complete order with remaining items
- Reset order from Complete → InProgress
- Edit locked barcode
- Inventory adjustments beyond negative threshold (configurable)
- Any write operation while SaleClosed=true (except scan/undo/manual fulfill which are always blocked)

### 7.4 Audit
Every admin override creates an AdminAction row.

---

## 8. API contract

### 8.1 Response envelope (required)
All endpoints return:
```json
{
  "success": true,
  "data": {},
  "errors": []
}
```

### 8.2 Error handling conventions
- 400: validation/business rule failure (e.g., walk-up exceeds available)
- 403: admin required / bad pin
- 404: not found
- 409: conflict (optional, allowed for concurrency conflicts)
- 500: unexpected errors (generic message to client; details in logs)

### 8.3 Required endpoints (explicit)

#### Settings
- `GET /api/settings`
- `PUT /api/settings/sale-closed` (admin)
  - body: `{ "saleClosed": true|false }`

#### Plants (PlantCatalog CRUD)
- `GET /api/plants?search=&activeOnly=&includeDeleted=`
- `POST /api/plants`
- `GET /api/plants/{id}`
- `PUT /api/plants/{id}`
- `DELETE /api/plants/{id}` (soft delete)

#### Inventory
- `GET /api/inventory?search=`
- `PUT /api/inventory/{plantId}` (admin required if decreasing beyond threshold OR if SaleClosed)
  - body: `{ "onHandQty": int, "reason": string, "notes": string|null }`
- `POST /api/inventory/adjust` (admin required if SaleClosed or threshold exceeded)
  - body: `{ "plantId": uuid, "deltaQty": int, "reason": string, "notes": string|null }`

#### Sellers (CRUD)
- `GET /api/sellers?search=&includeDeleted=`
- `POST /api/sellers`
- `GET /api/sellers/{id}`
- `PUT /api/sellers/{id}`
- `DELETE /api/sellers/{id}`

#### Customers (CRUD)
- `GET /api/customers?search=&includeDeleted=`
- `POST /api/customers` (auto pickup code)
- `GET /api/customers/{id}`
- `PUT /api/customers/{id}`
- `DELETE /api/customers/{id}`

#### Orders (CRUD)
- `GET /api/orders?search=&status=&isWalkUp=&sellerId=&customerId=&includeDeleted=`
- `POST /api/orders` (auto order number if missing)
- `GET /api/orders/{id}`
- `PUT /api/orders/{id}`
- `DELETE /api/orders/{id}`

#### Order lines
- `POST /api/orders/{id}/lines`
- `PUT /api/orders/{id}/lines/{lineId}`
- `DELETE /api/orders/{id}/lines/{lineId}`

#### Fulfillment
- `POST /api/orders/{id}/scan`
  - body: `{ "barcode": "string" }`
- `POST /api/orders/{id}/undo-last-scan`
- `POST /api/orders/{id}/complete`
- `POST /api/orders/{id}/reset` (admin; complete→inprogress)
- `GET /api/orders/{id}/events`

#### Walk-up
- `POST /api/walkup/orders`
  - creates order `IsWalkUp=true`, status Open
- adding/editing walk-up lines must enforce AvailableForWalkup

#### Imports
- `POST /api/import/plants`
- `POST /api/import/inventory`
- `POST /api/import/orders`
- `GET /api/import/batches`
- `GET /api/import/batches/{id}/issues`

#### Reports (in-app; no CSV exports v1)
- `GET /api/reports/dashboard-metrics`
- `GET /api/reports/low-inventory`
- `GET /api/reports/problem-orders`
- `GET /api/reports/seller/{sellerId}/orders`

#### Version (optional but recommended)
- `GET /api/version`

### 8.4 Example scan response (Accepted)
```json
{
  "success": true,
  "data": {
    "result": "Accepted",
    "orderId": "…",
    "plant": { "sku": "TOM-CHERRY", "name": "Cherry Tomato" },
    "line": { "qtyOrdered": 4, "qtyFulfilled": 3, "qtyRemaining": 1 },
    "orderRemainingItems": 6
  },
  "errors": []
}
```

### 8.5 Example scan response (WrongOrder hard block)
```json
{
  "success": false,
  "data": { "result": "WrongOrder" },
  "errors": ["Item not on this order. Edit the order to add this SKU before scanning it."]
}
```

---

## 9. Imports (CSV/Excel)

### 9.1 Required formats
- CSV and .xlsx are supported.
- Best-effort import: valid rows import; errors recorded in ImportIssues; import continues.

### 9.2 Recommended libraries
- CSV: CsvHelper
- Excel: ClosedXML (simpler) or ExcelDataReader

### 9.3 Templates (required)

#### Plants import columns (CSV)
```
Sku,Name,Variant,Price,Barcode,IsActive
```
Rules:
- Sku required
- Barcode required and unique
- Duplicate barcodes are skipped and logged
- If IsActive missing, default true

#### Inventory import columns (CSV)
```
Sku,OnHandQty
```
Rules:
- Unknown Sku → ImportIssue(UnknownSku)
- OnHandQty must be integer >= 0 (negative allowed only via adjustment/admin path)
- If Inventory row doesn’t exist, create it.
- If exists, overwrite OnHandQty (log that it was updated)

#### Orders import columns (CSV) — one row per line item
```
OrderNumber,CustomerFirstName,CustomerLastName,CustomerDisplayName,Phone,Email,PickupCode,SellerFirstName,SellerLastName,SellerDisplayName,Sku,Qty,IsWalkUp
```
Rules:
- CustomerDisplayName required if first/last missing
- Seller can be blank (SellerId null)
- If PickupCode blank → generate
- If OrderNumber blank → generate
- IsWalkUp default false
- Group rows by OrderNumber into one order with multiple lines
- Unknown Sku → ImportIssue(UnknownSku) for that row (skip line, order still imports if it has at least one valid line)

### 9.4 Import results UI
After import, UI must show:
- TotalRows, ImportedCount, SkippedCount
- Issues table with filter/search
- Ability to download issues as CSV (optional but recommended; if implemented, it is not the “reports export” feature)

---

## 10. SPA UX requirements (Tailwind)

### 10.1 Global app layout
- Header with app name: **Hampton Hawks Plant Sales**
- Global quick find shortcut: Ctrl+K
- Persistent footer on all pages:
  - “Powered by Logic NE”
- When SaleClosed=true: persistent banner at top of app.

### 10.2 Routes (required)
- `/` Dashboard
- `/settings` SaleClosed toggle (admin)
- `/plants` CRUD
- `/inventory` view/edit + adjustments
- `/customers` CRUD
- `/sellers` CRUD
- `/orders` list + filters
- `/orders/new` manual order entry
- `/orders/:id` edit order/lines + print
- `/pickup` lookup (fast search + A–Z)
- `/pickup/:orderId` pickup scan screen
- `/walkup/new` walk-up order creation
- `/imports` upload and results
- `/reports` in-app metrics pages
- `/docs` in-app documentation/help
- Print routes (see section 12)

### 10.3 Search and lookup speed (counter mode)
Lookup pages MUST include:

#### A–Z last name tabs
- A B C … Z #
- Default “All”
- Clicking filters by LastName initial
- Names without parseable last name go to `#`

#### Letter hotkeys (mandatory)
On lookup screens:
- If an input is NOT focused:
  - pressing `A–Z` selects that tab
  - pressing `#` selects the # tab
- `/` focuses the search input
- `Esc` clears and restores focus behavior

#### Recent items (mandatory)
- Recent Customers (last 10 viewed)
- Recent Sellers (last 10 viewed)
Stored in localStorage.

#### Scan-to-search support (recommended)
- If search box receives text+Enter:
  - if matches PickupCode → open customer
  - else if matches OrderNumber → open order
  - else normal search

### 10.4 Pickup scan screen UX (must feel like POS)
Pickup screen must include:

- Big scan input always focused
- Enter submits scan
- Big banner feedback + audio feedback
- “ITEMS REMAINING” big counter
- Highlight/scroll to last fulfilled line
- Last 10 scans list
- Undo last scan button
- Manual fulfill + reason UI (blocked when SaleClosed)
- Network failure banner if API fails
- Auto-refresh every 10 seconds

### 10.5 QoL feature list (mandatory)
All must be implemented:
- Audio feedback (success/fail/warn)
- Visual flash feedback
- Sticky scan focus
- Highlight last line
- Low inventory badges (<5 threshold configurable)
- Duplicate scan debounce (2 seconds)
- Confirm modals for delete
- Status chips (Open gray, InProgress blue, Complete green, Cancelled red, Problem amber)
- Dashboard metrics card + sale progress meter
- Admin reset order
- Manual fulfill with reason
- Problem flag on orders
- Network failure banner
- Polling refresh pickup screen

---

## 11. Printing (order sheets + packets + cheat sheets)

### 11.1 Printing approach (v1)
Use print-friendly HTML and browser printing (including “Save to PDF”). No PDF generation library required.

### 11.2 Print routes (required)
- `/print/order/:orderId` — single customer order sheet
- `/print/seller/:sellerId` — seller packet (one customer per page)
- `/print/cheatsheet/pickup`
- `/print/cheatsheet/lookup`
- `/print/cheatsheet/admin`
- `/print/cheatsheet/end-of-day`

### 11.3 Order sheet content (required)
Each page must include:

Header (large):
- **Hampton Hawks Plant Sales**
- “Customer Order Sheet”
- Customer name
- Order number
- Pickup code (large)
- Seller name (if present)
- Printed timestamp

Body table with columns:
- ✅ **Checked** (large checkbox box for pen)
- Plant Name
- SKU
- Qty Ordered
- Qty Fulfilled
- Qty Remaining

Footer:
- Notes lines
- Subtle footer: “Powered by Logic NE”

### 11.4 Seller packet behavior
- Shows all orders for seller.
- Default includes both preorder and walk-up, with toggles:
  - Include preorders (default on)
  - Include walk-ups (default on)
  - Include completed (default off)
- Sorting options:
  - Customer last name (default)
  - Order number
- **Page break after each customer**.

### 11.5 Print CSS requirements
- Use `@media print` rules:
  - Hide navigation/buttons via `.no-print`
  - Force page breaks with `.page-break`
- Must print well in grayscale.
- Checkbox squares must be thick and clear.

Example snippet:
```css
@media print {
  .no-print { display: none !important; }
  .page-break { page-break-after: always; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
```

---

## 12. Developer documentation (Swagger + Storybook + TypeDoc + in-app docs)

### 12.1 Backend XML docs + Swagger
Backend must:
- Generate XML docs file
- Include XML docs in Swagger
- Provide endpoint summaries, DTO schema docs, enum docs
- Swagger at `/swagger` in Development only (configurable)

**Project file requirement (example snippet):**
```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

### 12.2 Frontend docs
Frontend must include:
- **TypeDoc**: `npm run docs` generates static docs at `/web/docs`
- **Storybook**: `npm run storybook` shows interactive component docs
- Stories required for core components:
  - ScanInput, StatusChip, OrderLinesTable, QuickFindOverlay, AzTabs, PrintLayout components

### 12.3 In-app docs page
`/docs` must include:
- Scan workflow explanation
- SaleClosed behavior
- Admin override usage
- Walk-up protection explanation
- Keyboard shortcuts
- Links to cheat sheets print pages
- A short “common issues” section

---

## 13. Branding requirement
- App title: **Hampton Hawks Plant Sales**
- Footer on all pages and print views:
  - **Powered by Logic NE**

---

## 14. Cheat sheets (printable cards)

### 14.1 Format
- Print-friendly HTML with Tailwind.
- Optionally also store Markdown equivalents in `/docs/cheatsheets`.

### 14.2 Required cheat sheets and content
1) Pickup Station
- How to find an order
- How to scan
- Meaning of colors/sounds
- WrongOrder: “Edit order to add SKU”
- Undo scan
- Manual fulfill
- What SaleClosed means

2) Lookup + Print
- A–Z tabs
- Letter hotkeys
- Ctrl+K quick find
- Print customer order
- Print seller packet

3) Admin
- Toggle SaleClosed
- Force complete order
- Edit locked barcode
- Adjust inventory threshold
- Reset order

4) End-of-day
- Check dashboard progress meter
- Low inventory list
- Problem orders
- Confirm sale closed
- Print any needed packets

---

## 15. Code quality and commenting standards (mandatory)

### 15.1 Backend
- Controllers thin; services enforce business rules.
- Heavy XML docs and comments where logic is non-trivial.
- Explicit comments around transaction boundaries, lock choices, and invariants.

### 15.2 Frontend
- TSDoc on exported components/hooks.
- Comment headers for major screens: what it does, invariants (focus, debounce, polling).

### 15.3 Linting/formatting
- Backend: treat warnings as errors where practical.
- Frontend: ESLint + Prettier; no unused vars; strict TS.

---

## 16. Docker deployment

### 16.1 docker-compose.yml (required; reference implementation)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: plantapp
      POSTGRES_PASSWORD: plantapp
      POSTGRES_DB: hampton_hawks_plant_sales
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U plantapp"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    build: ./api
    environment:
      ASPNETCORE_URLS: http://+:8080
      ASPNETCORE_ENVIRONMENT: Production
      ConnectionStrings__Default: Host=postgres;Port=5432;Database=hampton_hawks_plant_sales;Username=plantapp;Password=plantapp
      APP_ADMIN_PIN: "1234"
      INVENTORY_NEGATIVE_ADJUST_THRESHOLD: "10"
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10

  web:
    build: ./web
    depends_on:
      - api
    ports:
      - "3000:80"

volumes:
  postgres_data:
```

### 16.2 API Dockerfile requirements
- Multi-stage build
- Release build
- Runs migrations at startup
- Exposes 8080

### 16.3 Web Dockerfile requirements
- Multi-stage build for Vite
- Serve via nginx
- SPA fallback (`try_files $uri /index.html`)

---

## 17. Testing (minimum required)
Even without full auth, the system must include:

### 17.1 Backend tests
- Unit tests for:
  - walk-up available calculation
  - sale closed blocks scan/undo/manual fulfill
  - scan wrong-order blocks
  - scan accepted adjusts fulfillment and inventory transactionally (mockable)
  - admin forced complete requires pin
- Integration tests recommended for scan endpoint using test Postgres container (optional but encouraged).

### 17.2 Frontend tests (lightweight)
- At least basic component tests or Storybook interaction tests for key components (optional but encouraged).

---

## 18. README requirements
README must include:
- What the app is
- How to run via docker-compose
- Required env vars
- Where to access web UI and Swagger (dev)
- How to print order sheets and cheat sheets
- How to toggle SaleClosed (admin pin)

---

## 19. Implementation notes (edge cases and expectations)

### 19.1 Inventory going negative
- Should never happen via scan.
- Must be blocked if OnHandQty <= 0.
- Admin adjustments may set negative only if explicitly allowed (recommended: disallow negative OnHandQty by default; allow only via admin if you choose). v1 default: **disallow negative OnHandQty**.

### 19.2 Duplicate barcodes in plant catalog
- DB enforces unique.
- Import skips duplicates and records ImportIssue.
- UI plant form validates uniqueness and shows friendly error.

### 19.3 Derived last name
- Used for A–Z tabs and faster lookup.
- Always editable by humans.

### 19.4 Performance
- Index on Barcode and Sku is mandatory.
- Search endpoints must be paginated (e.g., `page`, `pageSize`, default 25, max 200).

### 19.5 Pagination
At 5,000 orders:
- All list endpoints must support pagination.
- UI must support paging and search.

---

## 20. Acceptance criteria (what “done” means)

The system is accepted when:

1) Docker Compose brings up Postgres, API, and Web successfully.
2) You can import Plants, Inventory, and Orders.
3) You can CRUD Plants/Inventory/Customers/Sellers/Orders.
4) Pickup screen:
   - scans SKU barcodes and fulfills correctly
   - hard-blocks wrong-order scans
   - supports undo (restores inventory)
   - supports manual fulfill with reason
   - shows audio/visual feedback and last scans
5) Walk-up order creation enforces AvailableForWalkup protection.
6) SaleClosed disables scan/undo/manual fulfill absolutely.
7) Admin PIN gates forced completion, barcode edits, inventory threshold actions, toggling SaleClosed, reset order.
8) Seller lookup + printing:
   - you can find seller quickly (A–Z tabs + hotkeys)
   - print seller packet with one customer per page
9) Customer print:
   - print a single customer order sheet
10) Cheat sheets exist and print cleanly.
11) Swagger docs exist (dev) and include XML docs.
12) Storybook exists and documents major components.
13) TypeDoc output can be generated.
14) Footer reads: “Powered by Logic NE” on all pages and print views.

---

## 21. Glossary
- **SKU**: Unique plant product identifier (e.g., TOM-CHERRY-4IN).
- **Barcode**: The scannable string associated 1:1 with SKU.
- **Preorder**: `IsWalkUp=false` order.
- **Walk-up**: `IsWalkUp=true` order created at pickup time.
- **SaleClosed**: Global lock state preventing scanning/undo/manual fulfill.

---

# Appendix A — Keyboard shortcuts (must be implemented)

Global:
- `Ctrl+K`: Quick Find overlay
- `Esc`: Close overlays/modals; clear scan input when applicable

Lookup screens:
- `/`: focus search
- `A–Z`: jump A–Z tab when input not focused
- `#`: jump # tab when input not focused

Pickup screen:
- `Esc`: clear scan input
- Input always focused unless modal open

---

# Appendix B — Footer branding
Footer must read exactly:
- **Powered by Logic NE**
