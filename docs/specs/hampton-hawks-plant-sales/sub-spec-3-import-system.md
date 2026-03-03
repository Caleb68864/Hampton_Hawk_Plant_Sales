---
type: phase-spec
sub_spec: 3
title: "Import System (CSV/Excel)"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [2]
---

# Sub-Spec 3: Import System (CSV/Excel)

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 9 for all import rules, column formats, and error handling.

**Key principle:** Best-effort import. Valid rows import; errors recorded in ImportBatch/ImportIssue; import continues. Never fail the whole batch for one bad row.

---

## Implementation Steps

### Step 1: Add NuGet Packages

**Modify:** `/api/src/HamptonHawksPlantSales.Core/HamptonHawksPlantSales.Core.csproj`

Add: `CsvHelper`, `ClosedXML`

**Verify:** `cd api && dotnet restore && dotnet build`

---

### Step 2: Create Import DTOs

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/DTOs/ImportDtos.cs`
  - `ImportResultResponse` -- BatchId, TotalRows, ImportedCount, SkippedCount
  - `ImportBatchResponse` -- Id, Type, Filename, TotalRows, ImportedCount, SkippedCount, CreatedAt
  - `ImportIssueResponse` -- Id, RowNumber, IssueType, Barcode, Sku, Message, RawData

**Verify:** `cd api && dotnet build`

---

### Step 3: Create PlantImportHandler

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Services/PlantImportHandler.cs`

**Expected CSV columns:** `Sku,Name,Variant,Price,Barcode,IsActive`

**Logic:**
1. Parse each row (CSV or XLSX via ClosedXML)
2. Validate: Sku required, Barcode required
3. Check unique Barcode against DB -- if duplicate, skip row + ImportIssue(DuplicateBarcode)
4. Check unique Sku against DB -- if duplicate, skip row + ImportIssue(DuplicateSku)
5. IsActive default true if missing
6. Create PlantCatalog + Inventory (OnHandQty=0) for new plants
7. Track TotalRows, ImportedCount, SkippedCount

**Verify:** `cd api && dotnet build`

---

### Step 4: Create InventoryImportHandler

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Services/InventoryImportHandler.cs`

**Expected CSV columns:** `Sku,OnHandQty`

**Logic:**
1. Parse each row
2. Lookup PlantCatalog by Sku -- if not found, ImportIssue(UnknownSku)
3. OnHandQty must be integer >= 0 -- if invalid, ImportIssue(BadQuantity)
4. If Inventory row exists for PlantCatalogId, overwrite OnHandQty
5. If Inventory row doesn't exist, create it
6. Log that it was updated (InventoryAdjustment record optional here)

**Verify:** `cd api && dotnet build`

---

### Step 5: Create OrderImportHandler

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Services/OrderImportHandler.cs`

**Expected CSV columns:** `OrderNumber,CustomerFirstName,CustomerLastName,CustomerDisplayName,Phone,Email,PickupCode,SellerFirstName,SellerLastName,SellerDisplayName,Sku,Qty,IsWalkUp`

**Logic:**
1. Parse all rows, group by OrderNumber
2. For each group:
   a. Find or create Customer (match by PickupCode if provided, else by DisplayName)
   b. CustomerDisplayName required if first/last both missing
   c. Auto-generate PickupCode if blank
   d. Auto-generate OrderNumber if blank
   e. Find or create Seller if seller fields present (match by DisplayName)
   f. Create Order with lines
   g. For each line: lookup PlantCatalog by Sku -- if unknown, ImportIssue(UnknownSku), skip that line
   h. If order has at least one valid line, it imports; if zero valid lines, skip entire order
3. IsWalkUp default false

**Verify:** `cd api && dotnet build`

---

### Step 6: Create ImportService (Orchestrator)

**Create:**
- `/api/src/HamptonHawksPlantSales.Core/Interfaces/IImportService.cs`
- `/api/src/HamptonHawksPlantSales.Core/Services/ImportService.cs`

**Methods:**
- `ImportPlantsAsync(Stream file, string filename)` → ImportResultResponse
- `ImportInventoryAsync(Stream file, string filename)` → ImportResultResponse
- `ImportOrdersAsync(Stream file, string filename)` → ImportResultResponse
- `GetBatchesAsync(PaginationParams paging)` → PagedResult<ImportBatchResponse>
- `GetBatchIssuesAsync(Guid batchId, string? search, PaginationParams paging)` → PagedResult<ImportIssueResponse>

**Logic:**
- Detect file type by extension (.csv or .xlsx)
- Create ImportBatch record at start
- Delegate to appropriate handler
- Update ImportBatch with final counts
- Return ImportResultResponse

**Verify:** `cd api && dotnet build`

---

### Step 7: Create ImportController

**Create:**
- `/api/src/HamptonHawksPlantSales.Api/Controllers/ImportController.cs`

**Endpoints:**
- `POST /api/import/plants` -- accepts file upload (multipart/form-data)
- `POST /api/import/inventory` -- accepts file upload
- `POST /api/import/orders` -- accepts file upload
- `GET /api/import/batches` -- list import history
- `GET /api/import/batches/{id}/issues` -- list issues for a batch

**Verify:** `cd api && dotnet build`

---

### Step 8: Register Services + Smoke Test

**Modify Program.cs:** Register `IImportService`

**Test with sample CSVs:**
```bash
# Create sample plants CSV
echo "Sku,Name,Variant,Price,Barcode,IsActive" > /tmp/plants.csv
echo "TOM-CHERRY,Cherry Tomato,,3.50,100001,true" >> /tmp/plants.csv
echo "TOM-BEEF,Beefsteak Tomato,,4.00,100002,true" >> /tmp/plants.csv

curl -X POST http://localhost:8080/api/import/plants -F "file=@/tmp/plants.csv"
```

---

## Interface Contracts

### Provides:
- Import endpoints for plants, inventory, orders
- ImportBatch/ImportIssue query endpoints
- `IImportService` in DI

### Requires (from Sub-Spec 2):
- `IPlantService`, `ICustomerService`, `ISellerService`, `IOrderService` for entity lookup/creation
- `AppDbContext` for direct DB access where needed
- All DTOs and validators

### Shared State:
- ImportBatch/ImportIssue tables populated by imports
- PlantCatalog/Inventory/Customer/Seller/Order/OrderLine tables modified by imports

---

## Verification Commands

**Build:** `cd api && dotnet build`

**Test plants import:** `curl -X POST http://localhost:8080/api/import/plants -F "file=@sample-plants.csv"` → returns `{ success: true, data: { totalRows: N, importedCount: N, skippedCount: 0 } }`

**Test with bad data:** Include duplicate barcode row → skippedCount=1, check issues endpoint
