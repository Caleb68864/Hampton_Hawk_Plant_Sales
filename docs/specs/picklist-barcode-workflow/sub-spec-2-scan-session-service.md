---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
master_spec: "../2026-04-25-picklist-barcode-workflow.md"
title: "ScanSessionService -- backend logic"
---

# SS-02: ScanSessionService -- backend logic

## Scope
Implement `IScanSessionService`, controller, hosted expiry service. Reuse fulfillment row-lock contract for per-line scans. Exclude `Status=Draft` from aggregation.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IScanSessionService.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/DTOs/ScanSessionDtos.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Enums/ScanSessionResult.cs` (new -- Accepted, NotFound, AlreadyFulfilled, NotInSession, OutOfStock, SaleClosedBlocked, Expired)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionService.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionExpiryHostedService.cs` (new)
- `api/src/HamptonHawksPlantSales.Api/Controllers/ScanSessionsController.cs` (new)
- `api/src/HamptonHawksPlantSales.Api/Program.cs` (DI + hosted service)
- `api/tests/HamptonHawksPlantSales.Tests/ScanSessions/ScanSessionServiceTests.cs` (new)

## Patterns to Follow
- `FulfillmentService.ScanInternalAsync` for row-lock + retry.
- `IAdminService.IsSaleClosedAsync()` for sale-closed gate.
- Hosted service pattern: implement `BackgroundService` from `Microsoft.Extensions.Hosting`.

## Implementation Steps (TDD)

1. **Add DTOs:** `CreateScanSessionRequest { string ScannedBarcode; string WorkstationName }`, `ScanInSessionRequest { string PlantBarcode }`, `ScanSessionResponse` (id, entityKind, entityId, entityName, includedOrderIds, aggregatedLines, remainingTotal, expiresAt, closedAt).
2. **Define `IScanSessionService`** with the 6 methods from master spec.
3. **Write failing test:** `ScanSessionServiceTests.CreateFromPicklist_AggregatesAllOpenOrders`.
   - Seed: 1 customer, 2 open orders with 5 distinct plants total.
   - Call `CreateFromPicklistAsync("PLB-XXXX", "Pickup-1")`.
   - Expect: session has 2 members, aggregated lines count == 5.
4. **Implement `CreateFromPicklistAsync`:**
   - Parse prefix:
     - `PLB-` -> kind=Customer; lookup `Customers.Where(c => c.PicklistBarcode == @b)`.
     - `PLS-` -> kind=Seller; lookup `Sellers.Where(s => s.PicklistBarcode == @b)`.
     - else throw ValidationException ("Unknown pick-list prefix").
   - If entity not found: throw KeyNotFoundException.
   - Find open orders: `Status IN (Open, InProgress)`, `DeletedAt IS NULL`. EXCLUDES `Draft`.
   - If zero orders: throw ValidationException ("No open orders for this {customer|student}").
   - Insert ScanSession + members; ExpiresAt = now + 4 hours (configurable).
   - Return mapped session view.
5. **Implement `ScanInSessionAsync(sessionId, plantBarcode)`:**
   - Begin transaction.
   - Lock session; if `ClosedAt != null` or `ExpiresAt < now` -> return result `Expired`.
   - If sale closed -> return result `SaleClosedBlocked`.
   - Lookup plant by barcode. If not found -> `NotFound`.
   - Candidate query (with `FOR UPDATE` on result row):
     ```sql
     SELECT ol.* FROM "OrderLines" ol
     JOIN "ScanSessionMembers" m ON m."OrderId" = ol."OrderId"
     JOIN "Orders" o ON o."Id" = ol."OrderId"
     WHERE m."SessionId" = @s
       AND ol."PlantCatalogId" = @p
       AND ol."QtyFulfilled" < ol."QtyOrdered"
       AND ol."DeletedAt" IS NULL
       AND o."DeletedAt" IS NULL
       AND o."Status" <> 'Draft'
     ORDER BY o."CreatedAt" ASC, ol."CreatedAt" ASC
     LIMIT 1
     FOR UPDATE
     ```
   - If no candidate but a fully-fulfilled line for this plant exists in the session -> `AlreadyFulfilled`.
   - If no candidate and no line at all for this plant -> `NotInSession` (or `NotFound` if the plant isn't in the catalog, but we already validated that).
   - Increment `QtyFulfilled += 1`. Insert `FulfillmentEvent` (mirroring existing fulfillment event shape, no new fields).
   - Commit.
   - Return aggregated view + result.
6. **Implement `CloseAsync(id)`:** stamp `ClosedAt = now`. Subsequent scans return `Expired`/Gone.
7. **Implement `GetAsync(id)`:** return aggregated view including which lines remain.
8. **Implement `ExpandAsync` stub** (enabled only when a setting `scanSessionAdHocExpandEnabled` is true; default false).
9. **Implement `ExpireStaleAsync`** -- closes sessions where `ExpiresAt < now AND ClosedAt IS NULL`. Used by hosted service.
10. **Implement `ScanSessionExpiryHostedService : BackgroundService`** -- timer 5 minutes; calls `ExpireStaleAsync`.
11. **Add controller** `ScanSessionsController` with route `api/scan-sessions`. Endpoints: `POST /` (create), `GET /{id}`, `POST /{id}/scan`, `POST /{id}/close`, `POST /{id}/expand` (gated).
12. **Register DI + hosted service** in Program.cs.
13. **Add tests:** unknown barcode -> 404; PLB- with zero open orders -> 422; concurrent scan from two sessions for same line -> only one fulfills, second returns AlreadyFulfilled; expired session -> 410.

## Interface Contracts

### Provides
- HTTP endpoints `/api/scan-sessions/*` (consumed by SS-03).
- `ScanSessionResponse` JSON shape (consumed by SS-03).

### Requires
- From SS-01: `PicklistBarcode` columns; `ScanSession` and `ScanSessionMember` entities.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter ScanSessionServiceTests
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| IScanSessionService exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Interfaces/IScanSessionService.cs \|\| (echo "FAIL: IScanSessionService missing" && exit 1)` |
| ScanSessionService implementation exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionService.cs \|\| (echo "FAIL: ScanSessionService missing" && exit 1)` |
| Controller exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Api/Controllers/ScanSessionsController.cs \|\| (echo "FAIL: ScanSessionsController missing" && exit 1)` |
| Hosted expiry service exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionExpiryHostedService.cs \|\| (echo "FAIL: expiry hosted service missing" && exit 1)` |
| Service uses transactions | [STRUCTURAL] | `grep -q "BeginTransactionAsync" api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionService.cs \|\| (echo "FAIL: ScanSessionService not using transactions" && exit 1)` |
| Service excludes drafts | [STRUCTURAL] | `grep -q "Draft" api/src/HamptonHawksPlantSales.Infrastructure/Services/ScanSessionService.cs \|\| (echo "FAIL: drafts not filtered out of aggregation" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
| Service tests pass | [MECHANICAL] | `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet --filter ScanSessionServiceTests \|\| (echo "FAIL: scan session tests failed" && exit 1)` |
