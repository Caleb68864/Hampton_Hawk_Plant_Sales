---
type: phase-spec
sub_spec: 4
title: "Scan + Fulfillment Engine"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [2]
---

# Sub-Spec 4: Scan + Fulfillment Engine

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 5.1-5.6 for all business rules, Section 6 for concurrency/locking, Section 7 for admin PIN protocol, Section 8.4-8.5 for response examples.

**CRITICAL:** This is the most complex sub-spec. Transaction safety and correct locking are non-negotiable. See `spec.md` Section 6.1 for exact SQL locking pattern.

---

## Implementation Steps

### Step 1: Create Admin PIN Middleware/Filter

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Filters/AdminPinActionFilter.cs`
- `/api/src/HamptonHawksPlantSales.Api/Attributes/RequiresAdminPinAttribute.cs`

**Logic:**
- Custom attribute `[RequiresAdminPin]` marks endpoints needing admin auth
- Action filter reads `X-Admin-Pin` and `X-Admin-Reason` headers
- Compare PIN against `APP_ADMIN_PIN` env var
- If missing or wrong: return 403 with `ApiResponse` error
- If reason empty: return 403 with "Reason is required"
- Store reason in HttpContext.Items for service layer access

**Verify:** `cd api && dotnet build`

---

### Step 2: Create AdminService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IAdminService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/AdminService.cs`

**Methods:**
- `LogActionAsync(string actionType, string entityType, Guid entityId, string reason, string? message)` → AdminAction
- `IsSaleClosedAsync()` → bool

**Verify:** `cd api && dotnet build`

---

### Step 3: Create Scan DTOs

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ScanDtos.cs`
  - `ScanRequest` -- Barcode (string)
  - `ScanResponse` -- Result (enum string), OrderId, Plant (sku, name), Line (qtyOrdered, qtyFulfilled, qtyRemaining), OrderRemainingItems
  - `FulfillmentEventResponse` -- Id, OrderId, PlantCatalogId, Barcode, Result, Message, CreatedAt

**Verify:** `cd api && dotnet build`

---

### Step 4: Create FulfillmentService -- Scan Method

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IFulfillmentService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/FulfillmentService.cs`

**Method: `ScanAsync(Guid orderId, string barcode)` → ScanResponse**

**Full scan logic (spec Section 5.3):**
1. Check SaleClosed → if true, create FulfillmentEvent(SaleClosedBlocked), return
2. Normalize barcode: trim whitespace
3. Lookup PlantCatalog by Barcode → if not found, FulfillmentEvent(NotFound), return
4. Find OrderLine for orderId + PlantCatalogId → if none, FulfillmentEvent(WrongOrder), return
5. Check QtyFulfilled >= QtyOrdered → if yes, FulfillmentEvent(AlreadyFulfilled), return
6. Check Inventory.OnHandQty <= 0 → if yes, FulfillmentEvent(OutOfStock), return
7. **Transaction with row locks:**
   ```sql
   BEGIN;
   SELECT * FROM "Inventory" WHERE "PlantCatalogId" = @plantId AND "DeletedAt" IS NULL FOR UPDATE;
   SELECT * FROM "OrderLine" WHERE "OrderId" = @orderId AND "PlantCatalogId" = @plantId AND "DeletedAt" IS NULL FOR UPDATE;
   -- Re-check conditions after acquiring locks
   UPDATE "Inventory" SET "OnHandQty" = "OnHandQty" - 1, "UpdatedAt" = NOW();
   UPDATE "OrderLine" SET "QtyFulfilled" = "QtyFulfilled" + 1, "UpdatedAt" = NOW();
   INSERT INTO "FulfillmentEvent" (...) VALUES (...);
   -- Set BarcodeLockedAt if null
   UPDATE "PlantCatalog" SET "BarcodeLockedAt" = NOW() WHERE "Id" = @plantId AND "BarcodeLockedAt" IS NULL;
   COMMIT;
   ```
8. Use raw SQL via `AppDbContext.Database.ExecuteSqlRawAsync` or `FromSqlRaw` with `FOR UPDATE` for row locking
9. Return ScanResponse with Accepted result and updated counts

**Verify:** `cd api && dotnet build`

---

### Step 5: Create FulfillmentService -- Undo Method

**Method: `UndoLastScanAsync(Guid orderId)` → ScanResponse**

**Logic (spec Section 5.4):**
1. Check SaleClosed → if true, block (return error, no FulfillmentEvent for undo blocks)
2. Find most recent FulfillmentEvent for orderId where Result=Accepted, ordered by CreatedAt DESC
3. If none found → return error "Nothing to undo"
4. **Transaction with row locks:**
   - Lock Inventory row FOR UPDATE
   - Lock OrderLine row FOR UPDATE
   - Decrement QtyFulfilled by 1
   - Increment OnHandQty by 1
   - Create new FulfillmentEvent documenting the undo (use a special result or message)
5. Return updated counts

**Verify:** `cd api && dotnet build`

---

### Step 6: Create FulfillmentService -- Complete + Force Complete

**Method: `CompleteOrderAsync(Guid orderId)` → ApiResponse**

**Logic (spec Section 5.5):**
1. Load order with lines
2. Check all lines: QtyFulfilled == QtyOrdered for each
3. If not all fulfilled → return 400 error
4. Set Order.Status = Complete

**Method: `ForceCompleteOrderAsync(Guid orderId, string reason)` → ApiResponse**
1. Requires admin PIN (controller uses `[RequiresAdminPin]`)
2. Load order with lines
3. Set Order.Status = Complete
4. Log AdminAction with unfulfilled summary
5. Create FulfillmentEvent noting force complete

**Verify:** `cd api && dotnet build`

---

### Step 7: Create FulfillmentService -- Reset Order

**Method: `ResetOrderAsync(Guid orderId, string reason)` → ApiResponse**

**Logic:**
1. Requires admin PIN
2. Load order, verify Status == Complete
3. Set Status = InProgress
4. Log AdminAction

**Verify:** `cd api && dotnet build`

---

### Step 8: Create FulfillmentController

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/FulfillmentController.cs`

**Endpoints:**
- `POST /api/orders/{id}/scan` -- body: `{ "barcode": "string" }`
- `POST /api/orders/{id}/undo-last-scan`
- `POST /api/orders/{id}/complete`
- `POST /api/orders/{id}/force-complete` -- `[RequiresAdminPin]`
- `POST /api/orders/{id}/reset` -- `[RequiresAdminPin]`
- `GET /api/orders/{id}/events` -- list FulfillmentEvents for order

**Verify:** `cd api && dotnet build`

---

### Step 9: Register Services + Full Scan Test

**Register:** `IFulfillmentService`, `IAdminService` in DI

**Manual test sequence:**
```bash
# 1. Import a plant
curl -X POST http://localhost:8080/api/plants -H "Content-Type: application/json" \
  -d '{"sku":"TOM-1","name":"Tomato","barcode":"SCAN001"}'

# 2. Set inventory
curl -X PUT http://localhost:8080/api/inventory/<plantId> -H "Content-Type: application/json" \
  -d '{"onHandQty":10,"reason":"initial stock"}'

# 3. Create order with line
curl -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" \
  -d '{"customerId":"<id>","lines":[{"plantCatalogId":"<plantId>","qtyOrdered":3}]}'

# 4. Scan
curl -X POST http://localhost:8080/api/orders/<orderId>/scan -H "Content-Type: application/json" \
  -d '{"barcode":"SCAN001"}'
# Expected: Accepted, qtyFulfilled=1, qtyRemaining=2

# 5. Undo
curl -X POST http://localhost:8080/api/orders/<orderId>/undo-last-scan
# Expected: qtyFulfilled=0, inventory restored

# 6. Scan wrong barcode
curl -X POST http://localhost:8080/api/orders/<orderId>/scan -H "Content-Type: application/json" \
  -d '{"barcode":"DOESNOTEXIST"}'
# Expected: NotFound
```

---

## Interface Contracts

### Provides:
- `IFulfillmentService` with Scan, Undo, Complete, ForceComplete, Reset
- `IAdminService` with LogAction, IsSaleClosed
- `[RequiresAdminPin]` attribute for any endpoint needing admin auth
- FulfillmentEvent records for audit trail
- AdminAction records for admin audit

### Requires (from Sub-Spec 2):
- `AppDbContext`, all entity models
- `IOrderService` for order queries
- Response envelope pattern

### Shared State:
- FulfillmentEvent table -- written by scan/undo/complete
- AdminAction table -- written by admin actions
- Inventory.OnHandQty -- modified by scan/undo
- OrderLine.QtyFulfilled -- modified by scan/undo
- PlantCatalog.BarcodeLockedAt -- set by first accepted scan
- AppSettings.SaleClosed -- read by all scan operations

---

## Verification Commands

**Build:** `cd api && dotnet build`

**Concurrency test:** Open two terminal windows, scan the same barcode rapidly → should never double-decrement inventory below 0.
