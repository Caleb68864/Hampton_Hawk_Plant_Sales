---
date: 2026-04-14
author: Caleb Bennett
status: ready
source_plan: docs/plans/2026-04-14-orders-import-format-adapters-design.md
tags:
  - spec
  - import
---

# Orders Import — Format Adapters

## Meta
- **Project:** Hampton Hawks Plant Sales
- **Repo:** Hampton_Hawk_Plant_Sales
- **Date:** 2026-04-14
- **Author:** Caleb Bennett
- **Source plan:** `docs/plans/2026-04-14-orders-import-format-adapters-design.md` (evaluated)
- **Quality scores (out of 35):**
  - Outcome clarity: 5
  - Scope boundaries: 5
  - Decision guidance: 5
  - Edge coverage: 4
  - Acceptance criteria: 5 (all typed)
  - Decomposition: 4
  - Purpose alignment: 5
  - **Total: 33 / 35**

## Outcome
The three real-world annual files (`2026 Orders for Importing.xlsx`, `R1 Sales Offerings.xlsx`, `Sales by Product with flat totals.xlsx`) import end-to-end through the existing `/api/import/plants` and `/api/import/orders` endpoints without any manual file reshaping. Canonical CSV/xlsx uploads and PDF order uploads remain regression-free. Every `ImportBatch` records which adapter produced its canonical rows.

## Intent
**Trade-off hierarchy (highest → lowest):**
1. Preserve existing handler business logic and PDF path behavior (no regressions).
2. Match existing codebase conventions (Infrastructure/Services, ApiResponse envelope, one-entity-per-configuration).
3. Smallest viable surface area — do not build an import-profile entity, admin UI, or transform DSL.
4. Extensibility for next year's file shape (one new adapter class + registry entry).

**Decision boundaries (stop and ask):**
- A handler (`OrderImportHandler` / `PlantImportHandler`) signature change looks necessary.
- Synthesized `HH` + 12-digit barcode collides with an existing plant's barcode.
- PDF order path behavior diverges under the refactor.
- The 2026 orders file produces any `UnknownSku` after plants are imported.

**Decide autonomously:** adapter class naming, internal helper shape, log message wording, test file organization under `api/tests/HamptonHawksPlantSales.Tests/Import/`, folder layout under `Infrastructure/Services/ImportAdapters/`.

## Context
- API is .NET 9 / EF Core 9 / PostgreSQL; see `CLAUDE.md` at repo root for conventions (ApiResponse envelope, service-layer pattern, soft delete, kebab-case routes).
- Existing import surface lives in `api/src/HamptonHawksPlantSales.Infrastructure/Services/`:
  - `ImportService.cs` — orchestrator; contains inline `ReadXlsx`, `ReadCsv`, `ReadOrdersPdf` static helpers.
  - `PlantImportHandler.cs`, `OrderImportHandler.cs`, `InventoryImportHandler.cs` — consume `List<Dictionary<string,string>>` (canonical rows). **These do not change.**
  - `ImportController.cs` at `api/src/HamptonHawksPlantSales.Api/Controllers/` — routes `/api/import/{plants|orders|inventory}`.
- `ImportBatch` model at `api/src/HamptonHawksPlantSales.Core/Models/ImportBatch.cs` extends `EventEntity` with `Type, Filename, TotalRows, ImportedCount, SkippedCount`.
- Real-world source files sit at repo root: `2026 Orders for Importing.xlsx`, `R1 Sales Offerings.xlsx`, `Sales by Product with flat totals.xlsx`.
- Known source-file quirks:
  - 2026 Orders: blank row 1, headers in row 2 (`Order #, Name, Phone, Email, Seller, Item # , Qnty` — note trailing space on `Item # `), ~2,670 data rows.
  - R1 Sales Offerings: headers in row 1 (`Plant Name, Item number, Price`), 95 data rows, no Barcode column.
  - Sales by Product: headers in row 1 (`Plant Name, Item number, Price, # per flat, Total Units, Total Sales`), same plant set as R1.
- Existing `ImportService.ReadXlsx` throws `ValidationException` when row 1 is blank or any header cell is empty — this is the behavior that must be changed (blank leading rows tolerated; blank cells within a detected header row still rejected).

## Requirements
1. Introduce an adapter layer (`IImportFormatAdapter`, `FormatAdapterRegistry`) that translates source rows into the existing canonical row shape.
2. Replace (not parallel) `ImportService.ReadXlsx` and `ImportService.ReadCsv` with a reader that skips blank leading rows and trims header names. Preserve existing validation for missing worksheet, duplicate headers, and blank header cells once the header row is located.
3. Four concrete adapters: `CanonicalOrdersAdapter`, `CanonicalPlantsAdapter`, `HamptonHawks2026OrdersAdapter`, `HamptonHawksR1PlantsAdapter`.
4. Registry resolution: file-specific adapters tried first in registration order; canonical adapters last; ties among file-specific adapters log a warning and first-registered wins. No match → batch `Failed` with one `UnknownFormat` issue listing detected headers.
5. PDF order import bypasses the adapter registry unchanged; `ImportBatch.SourceFormat = "OrdersPdf"`.
6. EF migration adds `ImportBatch.SourceFormat` (nullable string). `ImportResultResponse.SourceFormat` (additive) surfaces the adapter name in API responses.
7. All seven acceptance criteria in the design plan pass (see sub-spec 3 for typed versions).

## Sub-Specs

### Sub-Spec 1 — Reader + Adapter Foundation
**Dependencies:** none

**Scope:**
- Create `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportReading/ExcelRowReader.cs` (or similar folder) with a single entry point `ReadXlsx(Stream)` → `(IReadOnlyList<string> headers, List<Dictionary<string,string>> rows)`. Scans top-down for the first non-blank row, treats it as the header row. Trims every header name. Preserves existing error surfaces: missing worksheet, blank header cell (after skipping blank leading rows), duplicate header names.
- Equivalent `CsvRowReader.ReadCsv(Stream)` that skips blank leading rows before handing to `CsvHelper`, and trims header names.
- Create `api/src/HamptonHawksPlantSales.Core/Interfaces/IImportFormatAdapter.cs`:
  - `ImportType Type { get; }`
  - `string Name { get; }`
  - `IReadOnlyList<string> RequiredHeaders { get; }`
  - `bool IsCanonical { get; }`
  - `bool Matches(IReadOnlyList<string> headers)` — default implementation: every `RequiredHeaders` entry (case-insensitive, trimmed) is a subset of `headers` (already trimmed by reader).
  - `Dictionary<string,string> Map(Dictionary<string,string> rawRow)`.
- Create `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/FormatAdapterRegistry.cs`:
  - Takes `IEnumerable<IImportFormatAdapter>` via DI.
  - `Resolve(ImportType type, IReadOnlyList<string> headers) → IImportFormatAdapter?` — file-specific (non-canonical) first in registration order; canonical last; logs a warning via `ILogger` on multi-match among file-specific adapters.
- Modify `ImportService.ImportAsync`:
  - Delete inline `ReadXlsx`/`ReadCsv` static helpers; call the new readers.
  - After parsing, call registry. On null: set `Batch.Status`/counts to Failed-equivalent (existing model has no explicit `Status`; emit one `ImportIssue { IssueType = "UnknownFormat", Message = "No adapter matched. Detected headers: ..." }`, set `ImportedCount=0`, `SkippedCount=TotalRows`).
  - On match: set `batch.SourceFormat = adapter.Name`; apply `adapter.Map` to every row; pass canonical rows to the existing handler.
  - PDF path in `ReadOrdersPdf` continues to call the handler directly; set `batch.SourceFormat = "OrdersPdf"`.
- Add `SourceFormat` (string, nullable, max 64) to `ImportBatch` model + `ImportBatchConfiguration` (HasMaxLength(64)). Create EF migration named `AddImportBatchSourceFormat` via:
  `dotnet ef migrations add AddImportBatchSourceFormat --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api`.
- Add `SourceFormat` (string?, nullable) to `ImportResultResponse` DTO and populate it in `ImportService`. Surface it on `ImportBatchResponse` as well.
- Register readers + registry + adapters in `Program.cs` (adapters registered as `IImportFormatAdapter` via `services.AddTransient`).

**Files touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportReading/ExcelRowReader.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportReading/CsvRowReader.cs` (new)
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IImportFormatAdapter.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/FormatAdapterRegistry.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportService.cs` (refactor: delete ReadXlsx/ReadCsv; add registry call + SourceFormat assignment)
- `api/src/HamptonHawksPlantSales.Core/Models/ImportBatch.cs` (+ `SourceFormat` property)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/ImportBatchConfiguration.cs` (HasMaxLength(64))
- `api/src/HamptonHawksPlantSales.Core/DTOs/ImportDtos.cs` (+ `SourceFormat` on `ImportResultResponse`, `ImportBatchResponse`)
- `api/src/HamptonHawksPlantSales.Api/Program.cs` (DI registration)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/*_AddImportBatchSourceFormat.{cs,Designer.cs}` (generated)
- `api/src/HamptonHawksPlantSales.Infrastructure/Data/AppDbContextModelSnapshot.cs` (regenerated)

**Acceptance criteria:**
- `[MECHANICAL]` `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` exits 0.
- `[STRUCTURAL]` `IImportFormatAdapter` interface exists at `api/src/HamptonHawksPlantSales.Core/Interfaces/IImportFormatAdapter.cs` with the five members listed in Scope.
- `[STRUCTURAL]` `FormatAdapterRegistry` class exists at `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/FormatAdapterRegistry.cs` and takes `IEnumerable<IImportFormatAdapter>` in its constructor.
- `[STRUCTURAL]` `ImportBatch.SourceFormat` property exists (nullable string); migration file matches glob `api/src/HamptonHawksPlantSales.Infrastructure/Data/Migrations/*_AddImportBatchSourceFormat.cs`.
- `[STRUCTURAL]` `ImportResultResponse.SourceFormat` property exists (nullable string).
- `[STRUCTURAL]` `ImportService.ReadXlsx` and `ImportService.ReadCsv` static methods no longer exist (grep returns zero hits for `private static List<Dictionary<string, string>> ReadXlsx` and `ReadCsv` in `ImportService.cs`).
- `[BEHAVIORAL]` Unit test: feeding the reader a synthetic xlsx with blank row 1 and headers in row 2 returns those headers; feeding a synthetic xlsx with a blank cell inside the detected header row throws `ValidationException`.
- `[BEHAVIORAL]` Unit test: `FormatAdapterRegistry.Resolve` with a canonical-only set of headers returns the canonical adapter; with a file-specific match returns the file-specific adapter; with no match returns null.

### Sub-Spec 2 — Concrete Adapters
**Dependencies:** Sub-Spec 1

**Scope:** Implement four adapters under `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/`:

- **`CanonicalOrdersAdapter`** (`IsCanonical=true`, `Type=Orders`, `Name="CanonicalOrders"`). `RequiredHeaders = ["OrderNumber", "Sku", "QtyOrdered"]` (the minimum the existing handler relies on; display name / customer is validated downstream). `Map` passes through.
- **`CanonicalPlantsAdapter`** (`IsCanonical=true`, `Type=Plants`, `Name="CanonicalPlants"`). `RequiredHeaders = ["Sku", "Name", "Barcode"]`. `Map` passes through.
- **`HamptonHawks2026OrdersAdapter`** (`IsCanonical=false`, `Type=Orders`, `Name="HamptonHawks2026Orders"`). `RequiredHeaders = ["Order #", "Name", "Item #", "Qnty"]` (matched case-insensitively and whitespace-trimmed; `"Item # "` in the source file matches `"Item #"`).  `Map` produces:
  - `OrderNumber` = raw `Order #` as string
  - `CustomerDisplayName` = raw `Name` (full)
  - `CustomerFirstName` = first space-delimited token of `Name` or empty
  - `CustomerLastName` = remainder after first space or empty
  - `Phone`, `Email` = passthrough (keys `"Phone"`, `"Email"`)
  - `SellerDisplayName` = raw `Seller`
  - `SellerFirstName` / `SellerLastName` = first-space split of `Seller`
  - `Sku` = raw `Item #` as string
  - `QtyOrdered` = raw `Qnty`
  - `IsWalkUp` = `"false"`
- **`HamptonHawksR1PlantsAdapter`** (`IsCanonical=false`, `Type=Plants`, `Name="HamptonHawksR1Plants"`). `RequiredHeaders = ["Plant Name", "Item number", "Price"]`. `Map` produces:
  - `Sku` = raw `Item number` as string
  - `Name` = raw `Plant Name`
  - `Price` = raw `Price`
  - `Barcode` = `"HH" + Sku.PadLeft(12, '0')` (e.g. `101` → `HH000000000101`)
  - `IsActive` = `"true"`
  - Extra columns (`# per flat`, `Total Units`, `Total Sales`) ignored implicitly.

All four adapters registered in `Program.cs` as `IImportFormatAdapter` (AddTransient) so the registry picks them up.

**Files touched:**
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/CanonicalOrdersAdapter.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/CanonicalPlantsAdapter.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/HamptonHawks2026OrdersAdapter.cs` (new)
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/HamptonHawksR1PlantsAdapter.cs` (new)
- `api/src/HamptonHawksPlantSales.Api/Program.cs` (register adapters)

**Acceptance criteria:**
- `[STRUCTURAL]` All four adapter classes exist under `ImportAdapters/` and implement `IImportFormatAdapter`.
- `[STRUCTURAL]` grep of `Program.cs` contains registrations for all four adapter types.
- `[BEHAVIORAL]` Unit test: `HamptonHawks2026OrdersAdapter.Map({"Order #":"2","Name":"Pat Anderson","Phone":"402-631-9542","Email":"","Seller":"Lofton Ferguson","Item #":"112","Qnty":"4"})` returns a dictionary with `OrderNumber="2"`, `CustomerFirstName="Pat"`, `CustomerLastName="Anderson"`, `CustomerDisplayName="Pat Anderson"`, `SellerFirstName="Lofton"`, `SellerLastName="Ferguson"`, `Sku="112"`, `QtyOrdered="4"`, `IsWalkUp="false"`.
- `[BEHAVIORAL]` Unit test: `HamptonHawks2026OrdersAdapter.Map` with a single-token Name like `"Cher"` returns `CustomerFirstName="Cher"`, `CustomerLastName=""`, `CustomerDisplayName="Cher"`.
- `[BEHAVIORAL]` Unit test: `HamptonHawksR1PlantsAdapter.Map({"Plant Name":"Begonia (Assorted)","Item number":"101","Price":"3"})` returns `Sku="101"`, `Name="Begonia (Assorted)"`, `Price="3"`, `Barcode="HH000000000101"`, `IsActive="true"`.
- `[BEHAVIORAL]` Unit test: `HamptonHawks2026OrdersAdapter.Matches(["Order #","Name","Phone","Email","Seller","Item # ","Qnty"])` returns true (trailing space tolerance).
- `[BEHAVIORAL]` Unit test: `CanonicalPlantsAdapter.Matches(["Sku","Name","Barcode","Variant","Price","IsActive"])` returns true (extra canonical fields permitted).

### Sub-Spec 3 — Integration Tests Against Real Files
**Dependencies:** Sub-Spec 1, Sub-Spec 2

**Scope:**
- Copy the three real source files into `api/tests/HamptonHawksPlantSales.Tests/Fixtures/Import/`:
  - `R1_Sales_Offerings.xlsx`
  - `Sales_by_Product_with_flat_totals.xlsx`
  - `2026_Orders_for_Importing.xlsx`
  (Trimmed copies are acceptable if full files exceed reasonable test-asset size; trimmed versions must still exhibit the blank-row-1 quirk and cover the same header shape.)
- Add integration tests under `api/tests/HamptonHawksPlantSales.Tests/Import/ImportFormatAdaptersTests.cs` using an in-memory or sqlite-backed `AppDbContext` (match whatever `PlantImportHandlerTests` / `OrderImportHandlerTests` do if they exist; otherwise use `Microsoft.EntityFrameworkCore.Sqlite` in-memory mode).
- Configure test DI to wire the real `ImportService` + readers + registry + all four adapters + handlers.
- Tests (each corresponds to a design-plan acceptance criterion):
  1. `R1PlantsImport_Creates95PlantsWithHHBarcodes`: upload R1 file → 95 plants created, 0 issues, every plant's barcode matches `^HH\d{12}$`, every plant `IsActive=true`, batch.SourceFormat="HamptonHawksR1Plants".
  2. `SalesByProductImport_IsIdempotentWithR1`: upload R1 then `Sales by Product` with `upsertBySku=true` → second run creates 0 new plants, extra columns ignored, batch.SourceFormat="HamptonHawksR1Plants".
  3. `Orders2026Import_GroupsRowsByOrderNumberWithZeroUnknownSku`: upload plants first, then 2026 orders → zero `UnknownSku` issues, order count equals distinct `Order #` values in the file, every order has `IsWalkUp=false` and `Status=Open`, batch.SourceFormat="HamptonHawks2026Orders".
  4. `CanonicalCsvOrders_StillImports`: synthetic canonical CSV uploads still work, batch.SourceFormat="CanonicalOrders".
  5. `CanonicalXlsxPlants_StillImports`: synthetic canonical xlsx with headers `Sku, Name, Barcode, Variant, Price, IsActive` uploads, batch.SourceFormat="CanonicalPlants".
  6. `UnknownFormat_FailsWithUnknownFormatIssue`: xlsx with completely foreign headers → zero rows imported, one issue of type `"UnknownFormat"`, batch.SourceFormat=null.
  7. `PdfOrderImport_RegressionUnchanged`: if existing PDF-order test fixtures exist, assert batch.SourceFormat="OrdersPdf" and output rows match a pre-refactor baseline stored as a JSON snapshot in the fixtures folder. If no PDF fixture exists in the repo, skip this test with `Skip="no PDF fixture available"`.

**Files touched:**
- `api/tests/HamptonHawksPlantSales.Tests/Fixtures/Import/R1_Sales_Offerings.xlsx` (new; copy of repo-root file)
- `api/tests/HamptonHawksPlantSales.Tests/Fixtures/Import/Sales_by_Product_with_flat_totals.xlsx` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Fixtures/Import/2026_Orders_for_Importing.xlsx` (new)
- `api/tests/HamptonHawksPlantSales.Tests/Import/ImportFormatAdaptersTests.cs` (new)

**Acceptance criteria:**
- `[MECHANICAL]` `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet` exits 0 (all tests green, including the seven new integration tests).
- `[INTEGRATION]` Running the full suite exercises plant import → order import end-to-end: `Orders2026Import_GroupsRowsByOrderNumberWithZeroUnknownSku` depends on a prior call that imports the R1 plants, asserting canonical-row flow from xlsx → reader → adapter → registry → ImportService → handler → DB.
- `[STRUCTURAL]` All three xlsx fixtures exist under `api/tests/HamptonHawksPlantSales.Tests/Fixtures/Import/`.

## Edge Cases
- **Blank leading row** (2026 orders): reader scans past blank rows until it finds a non-blank row, treats that as headers.
- **Header with trailing whitespace** (`"Item # "`): reader trims; `Matches()` compares trimmed, case-insensitive.
- **Single-token name** (`"Cher"`): first-space split produces `FirstName="Cher"`, `LastName=""`, `DisplayName="Cher"` — existing handler uses DisplayName.
- **Three-token name** (`"Mary Sue Smith"`): first-space split produces `FirstName="Mary"`, `LastName="Sue Smith"`. Acceptable.
- **Non-numeric qty** or missing Sku in a row: adapter emits the canonical row as-is; handler's existing row-level validation emits `ImportIssue` and skips. No adapter-level row exceptions.
- **File matches a canonical adapter AND a file-specific adapter**: file-specific wins (registry tries non-canonical first).
- **File matches two file-specific adapters** (shouldn't happen with current four, but defensive): first-registered wins, warning logged with both adapter names.
- **Orders imported before plants**: every line emits `UnknownSku`, order is not created; batch result clearly shows the skip count. No data corruption.
- **Barcode collision** on R1 import: synthesized `HH` barcode collides with an existing plant's barcode owned by a different SKU. Existing `PlantImportHandler` raises a `DuplicateBarcode` issue; the row is skipped (handler behavior is unchanged). Flag to human (escalation trigger).

## Out of Scope
- Import-profile entity, admin UI, or DB-stored column mappings (Approach B from the design — explicitly deferred).
- Upload-and-map UI (Approach C — explicitly rejected).
- Fuzzy header matching across synonyms (e.g. `"Qty"` vs `"Qnty"`).
- Changes to `OrderImportHandler` or `PlantImportHandler` business logic.
- Changes to `InventoryImportHandler` (no known format variations).
- Populating `OrderDate`, `Notes`, or `Price` on order lines (2026 file lacks a date column; order handler doesn't use Price today).
- Deleting or deprecating `ImportService.ReadOrdersPdf`.
- Barcode-format change from the `HH` + 12-digit scheme.

## Constraints

**Musts:**
- EF migration named `AddImportBatchSourceFormat` exists and is the only schema change.
- `ImportBatch.SourceFormat` populated on every non-failed batch.
- All four adapters registered in `Program.cs`.
- `dotnet build` and `dotnet test` pass.

**Must-Nots:**
- Do not modify `OrderImportHandler.HandleAsync` or `PlantImportHandler.HandleAsync` logic.
- Do not change the signature or behavior of `ImportService.ReadOrdersPdf`.
- Do not break existing canonical CSV/xlsx imports (`[BEHAVIORAL]` tests 4 and 5 guard this).
- Do not introduce a new endpoint or change existing route paths.
- Do not bypass the `ApiResponse<T>` envelope in the controller layer.

**Preferences:**
- Prefer reusing ClosedXML and CsvHelper (already referenced) over introducing new parsing libraries.
- Prefer small adapter classes (one file each) over a single switch-on-name mega-adapter.
- Prefer pushing blank-leading-row handling into the reader rather than into each adapter.

**Escalation Triggers:**
- A handler signature change seems necessary.
- Synthesized `HH` barcode collides with an existing non-R1 plant.
- PDF order path behavior changes.
- Any acceptance criterion cannot be satisfied without a scope expansion.

## Verification
Run `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` and `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet`. Both must exit 0. All seven integration tests in `ImportFormatAdaptersTests.cs` must pass. Manual smoke test: `POST /api/import/plants` with `R1 Sales Offerings.xlsx` (dryRun=false) returns `success=true`, `sourceFormat="HamptonHawksR1Plants"`, 95 imported; then `POST /api/import/orders` with `2026 Orders for Importing.xlsx` returns `success=true`, `sourceFormat="HamptonHawks2026Orders"`, zero UnknownSku issues.
