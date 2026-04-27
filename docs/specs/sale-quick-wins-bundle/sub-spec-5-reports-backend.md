---
sub_spec_id: SS-05
phase: run
depends_on: []
master_spec: "../2026-04-25-sale-quick-wins-bundle.md"
title: "Reports expansion -- backend"
---

# SS-05: Reports expansion -- backend

## Scope
Add aggregate methods to `IReportsService` and matching `ReportsController` endpoints for sales-by-seller, sales-by-customer, and (optional) sales-by-plant. Use EF LINQ with appropriate joins and soft-delete filters. Returns: `orderCount`, `itemsOrdered`, `itemsFulfilled`, `revenueOrdered`, `revenueFulfilled`.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Core/DTOs/ReportsDtos.cs` (modify -- add row DTOs)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ReportService.cs` (modify)
- `api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs` (modify)
- `api/tests/HamptonHawksPlantSales.Tests/Reports/SalesBySellerTests.cs` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Reports/SalesByCustomerTests.cs` (new)

## Patterns to Follow
- Existing report endpoints: `dashboardMetrics`, `lowInventory`, `problemOrders` -- look at their LINQ shape and DTO mapping.
- LEFT JOIN via `.Include(...)` and `.SelectMany(...)` or via raw projection.
- Null-safe revenue: `(decimal?)(ol.QtyFulfilled * pc.Price) ?? 0` where Price is nullable.

## Implementation Steps (TDD)

1. **Add DTOs** in `ReportsDtos.cs`:
   - `SalesBySellerRow { Guid SellerId; string SellerDisplayName; int OrderCount; int ItemsOrdered; int ItemsFulfilled; decimal RevenueOrdered; decimal RevenueFulfilled }`.
   - `SalesByCustomerRow { Guid CustomerId; string CustomerDisplayName; int OrderCount; int ItemsOrdered; int ItemsFulfilled; decimal RevenueOrdered; decimal RevenueFulfilled }`.
   - `SalesByPlantRow { Guid PlantCatalogId; string PlantName; string PlantSku; int OrderCount; int ItemsOrdered; int ItemsFulfilled; decimal RevenueOrdered; decimal RevenueFulfilled }`.
2. **Extend `IReportsService`** with `Task<List<SalesBySellerRow>> GetSalesBySellerAsync()`, `Task<List<SalesByCustomerRow>> GetSalesByCustomerAsync()`, `Task<List<SalesByPlantRow>> GetSalesByPlantAsync()` (optional).
3. **Write failing test:** `SalesBySellerTests.GetSalesBySeller_ReturnsAggregatedRows`.
   - Seed: 3 sellers each with 2 orders, 5 lines total per seller, prices set, mixed fulfillment.
   - Call `GetSalesBySellerAsync`.
   - Expect 3 rows; revenueOrdered = sum(QtyOrdered*Price); revenueFulfilled = sum(QtyFulfilled*Price); itemsOrdered/itemsFulfilled = sum.
4. **Implement `GetSalesBySellerAsync`:**
   - LINQ over `_db.Sellers` LEFT JOIN `Orders` (on `SellerId`, `Order.DeletedAt == null`) LEFT JOIN `OrderLines` (`OrderLine.DeletedAt == null`) LEFT JOIN `PlantCatalog`.
   - GroupBy seller.
   - Aggregate: `OrderCount = orders.Where(o => o != null).Select(o => o.Id).Distinct().Count()`, etc.
   - Project to `SalesBySellerRow`.
5. **Implement `GetSalesByCustomerAsync`** identical but joining on `CustomerId`.
6. **Implement `GetSalesByPlantAsync`** if time permits in this sub-spec; otherwise mark as stretch and ship without it.
7. **Add controller endpoints** under existing `[Route("api/reports")]`:
   - `[HttpGet("sales-by-seller")]` -> returns `Ok(ApiResponse<List<SalesBySellerRow>>.Ok(...))`.
   - `[HttpGet("sales-by-customer")]` -> same shape.
   - `[HttpGet("sales-by-plant")]` -> same shape (optional).
8. **Run tests** -- expect green.
9. **Add empty/zero-revenue test:** seller with no orders shows `OrderCount=0`, revenue 0 (LEFT JOIN keeps the row).
10. **Add soft-delete test:** soft-deleted order excluded from totals.

## Interface Contracts

### Provides
- `SalesBySellerRow`, `SalesByCustomerRow`, `SalesByPlantRow` DTOs (consumed by SS-06).
- `GET /api/reports/sales-by-seller`, `/sales-by-customer`, `/sales-by-plant` endpoints (consumed by SS-06).

### Requires
- None.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter "SalesBySellerTests|SalesByCustomerTests"
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Sales DTOs exist | [STRUCTURAL] | `grep -q "SalesBySellerRow" api/src/HamptonHawksPlantSales.Core/DTOs/ReportsDtos.cs && grep -q "SalesByCustomerRow" api/src/HamptonHawksPlantSales.Core/DTOs/ReportsDtos.cs \|\| (echo "FAIL: Sales DTOs missing" && exit 1)` |
| IReportsService has GetSalesBySellerAsync | [STRUCTURAL] | `grep -q "GetSalesBySellerAsync" api/src/HamptonHawksPlantSales.Core/Interfaces/IReportService.cs \|\| (echo "FAIL: GetSalesBySellerAsync missing on interface" && exit 1)` |
| ReportsController has sales-by-seller route | [STRUCTURAL] | `grep -q "sales-by-seller" api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs \|\| (echo "FAIL: sales-by-seller route missing" && exit 1)` |
| ReportsController has sales-by-customer route | [STRUCTURAL] | `grep -q "sales-by-customer" api/src/HamptonHawksPlantSales.Api/Controllers/ReportsController.cs \|\| (echo "FAIL: sales-by-customer route missing" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Sales tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter "SalesBySellerTests|SalesByCustomerTests" \|\| (echo "FAIL: sales report tests failed" && exit 1)` |
