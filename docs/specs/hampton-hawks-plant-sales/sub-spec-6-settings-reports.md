---
type: phase-spec
sub_spec: 6
title: "Settings + SaleClosed + Reports API"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [2]
---

# Sub-Spec 6: Settings + SaleClosed + Reports API

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 5.1 for SaleClosed rules, Section 8.3 for report endpoints.

---

## Implementation Steps

### Step 1: Create SettingsService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/ISettingsService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/SettingsService.cs`
- `/api/src/HamptonHawksPlantSales.Core/DTOs/SettingsDtos.cs` -- SettingsResponse, UpdateSaleClosedRequest

**Methods:**
- `GetSettingsAsync()` → SettingsResponse (SaleClosed, SaleClosedAt)
- `ToggleSaleClosedAsync(bool saleClosed, string reason)` → SettingsResponse
  - Sets SaleClosed + SaleClosedAt (null if opening)
  - Logs AdminAction (ActionType=ToggleSaleClosed)

**Verify:** `cd api && dotnet build`

---

### Step 2: Create SettingsController

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/SettingsController.cs`

**Endpoints:**
- `GET /api/settings` → SettingsResponse
- `PUT /api/settings/sale-closed` -- `[RequiresAdminPin]` -- body: `{ "saleClosed": bool }`

**Verify:** `cd api && dotnet build`

---

### Step 3: Create ReportService

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/ReportService.cs`
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ReportDtos.cs`

**DTOs:**
- `DashboardMetricsResponse` -- totalOrders, ordersByStatus (dict), totalItemsOrdered, totalItemsFulfilled, saleProgressPercent
- `LowInventoryResponse` -- list of plants with onHandQty < threshold, includes plantName, sku, onHandQty
- `ProblemOrderResponse` -- orders with HasIssue=true, includes customer name, order number, status

**Methods:**
- `GetDashboardMetricsAsync()` → DashboardMetricsResponse
- `GetLowInventoryAsync(int threshold = 5)` → List<LowInventoryResponse>
- `GetProblemOrdersAsync()` → List<ProblemOrderResponse>
- `GetSellerOrdersAsync(Guid sellerId)` → list of orders with fulfillment summary

**Verify:** `cd api && dotnet build`

---

### Step 4: Create ReportsController + Version Endpoint

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs`
- Add `GET /api/version` to a VersionController or inline in Program.cs

**Endpoints:**
- `GET /api/reports/dashboard-metrics`
- `GET /api/reports/low-inventory?threshold=5`
- `GET /api/reports/problem-orders`
- `GET /api/reports/seller/{sellerId}/orders`
- `GET /api/version` → `{ "version": "1.0.0" }`

**Verify:** `cd api && dotnet build`

---

### Step 5: Register Services + Test

**Register:** `ISettingsService`, `IReportService` in DI

**Test:**
```bash
# Get settings
curl http://localhost:8080/api/settings
# Expected: { success: true, data: { saleClosed: false, saleClosedAt: null } }

# Toggle sale closed
curl -X PUT http://localhost:8080/api/settings/sale-closed \
  -H "Content-Type: application/json" \
  -H "X-Admin-Pin: 1234" \
  -H "X-Admin-Reason: end of day" \
  -d '{"saleClosed": true}'

# Dashboard metrics
curl http://localhost:8080/api/reports/dashboard-metrics

# Version
curl http://localhost:8080/api/version
```

---

## Interface Contracts

### Provides:
- `ISettingsService` -- used by FulfillmentService (sub-spec 4) to check SaleClosed
- `IReportService` -- used by frontend dashboard
- Settings and report API endpoints

### Requires (from Sub-Spec 2):
- `AppDbContext`, entity models
- Response envelope pattern
- `[RequiresAdminPin]` from sub-spec 4 (or register filter in sub-spec 2)

**Note:** Sub-spec 4's FulfillmentService calls `IAdminService.IsSaleClosedAsync()` which queries AppSettings. If sub-spec 6 runs after sub-spec 4, ensure SettingsService and AdminService don't duplicate the SaleClosed query logic. Consider having AdminService delegate to SettingsService or share a common method.

---

## Verification Commands

**Build:** `cd api && dotnet build`
**Settings toggle:** Verify SaleClosed toggles and SaleClosedAt is set/cleared
**Dashboard:** Verify metrics return correct counts after importing test data
