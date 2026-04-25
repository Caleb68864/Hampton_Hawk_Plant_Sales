---
sub_spec_id: SS-01
phase: run
depends_on: []
master_spec: "../2026-04-25-picklist-barcode-workflow.md"
title: "Pick-list barcode columns + entities + migrations"
---

# SS-01: Schema additions

## Scope
Add `PicklistBarcode` to `Customer` and `Seller`. Add `ScanSession` and `ScanSessionMember` entities. Generate values for existing rows during migration.

## Files to Touch
- `api/src/HamptonHawksPlantSales.Core/Models/Customer.cs`
- `api/src/HamptonHawksPlantSales.Core/Models/Seller.cs`
- `api/src/HamptonHawksPlantSales.Core/Models/ScanSession.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Models/ScanSessionMember.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Enums/ScanSessionEntityKind.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/CustomerConfiguration.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/SellerConfiguration.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/ScanSessionConfiguration.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/ScanSessionMemberConfiguration.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Migrations/{ts}_AddPicklistBarcodesAndScanSessions.cs`

## Implementation Steps

1. **Add `ScanSessionEntityKind`** enum: `Customer = 0`, `Seller = 1`, `AdHoc = 2`.
2. **Add `Customer.PicklistBarcode`** (string, max 32, default empty for migration; backfill below).
3. **Add `Seller.PicklistBarcode`** (string, max 32).
4. **Add `ScanSession`** model: `Id`, `CreatedAt`, `ClosedAt?`, `ExpiresAt`, `WorkstationName`, `EntityKind`, `EntityId?` (Guid?), inherits `BaseEntity`.
5. **Add `ScanSessionMember`** model: `SessionId`, `OrderId`, plus `BaseEntity` defaults.
6. **Configurations:**
   - `Customer.PicklistBarcode`: required, unique index.
   - `Seller.PicklistBarcode`: required, unique index.
   - `ScanSession`: index on `EntityKind+EntityId`, on `ClosedAt`, on `ExpiresAt`.
   - `ScanSessionMember`: composite index on `(SessionId, OrderId)`, FK to `Order` and `ScanSession`.
7. **Generate migration:** `dotnet ef migrations add AddPicklistBarcodesAndScanSessions ...`.
8. **Edit migration `Up()`** to backfill existing rows. After the `AddColumn`s for `PicklistBarcode`:
   ```csharp
   migrationBuilder.Sql(@"
       UPDATE ""Customers""
       SET ""PicklistBarcode"" = 'PLB-' || substr(md5(random()::text || ""Id""::text), 1, 8)
       WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;
       UPDATE ""Sellers""
       SET ""PicklistBarcode"" = 'PLS-' || substr(md5(random()::text || ""Id""::text), 1, 8)
       WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;
   ");
   ```
9. **Apply migration** via `dotnet ef database update`. Confirm `SELECT COUNT(*) FROM "Customers" WHERE "PicklistBarcode" IS NULL OR "PicklistBarcode" = ''` returns 0.
10. **Verify uniqueness** -- no duplicates due to id-based hash.

## Interface Contracts

### Provides
- `Customer.PicklistBarcode`, `Seller.PicklistBarcode` (consumed by SS-02 + SS-04).
- `ScanSession`, `ScanSessionMember` entities (consumed by SS-02).

### Requires
- None.

## Verification Commands

```sh
cd api
dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Customer.PicklistBarcode exists | [STRUCTURAL] | `grep -q "PicklistBarcode" api/src/HamptonHawksPlantSales.Core/Models/Customer.cs \|\| (echo "FAIL: Customer.PicklistBarcode missing" && exit 1)` |
| Seller.PicklistBarcode exists | [STRUCTURAL] | `grep -q "PicklistBarcode" api/src/HamptonHawksPlantSales.Core/Models/Seller.cs \|\| (echo "FAIL: Seller.PicklistBarcode missing" && exit 1)` |
| ScanSession model exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Models/ScanSession.cs \|\| (echo "FAIL: ScanSession model missing" && exit 1)` |
| ScanSessionMember model exists | [STRUCTURAL] | `test -f api/src/HamptonHawksPlantSales.Core/Models/ScanSessionMember.cs \|\| (echo "FAIL: ScanSessionMember model missing" && exit 1)` |
| Migration exists | [STRUCTURAL] | `ls api/src/HamptonHawksPlantSales.Infrastructure/Migrations/*PicklistBarcodes* >/dev/null 2>&1 \|\| (echo "FAIL: migration not generated" && exit 1)` |
| Build passes | [MECHANICAL] | `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet \|\| (echo "FAIL: build failed" && exit 1)` |
