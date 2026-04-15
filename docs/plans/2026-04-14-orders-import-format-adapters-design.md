---
date: 2026-04-14
evaluated_date: 2026-04-14
topic: "Import system for 2026 Orders xlsx (and R1 plant offerings)"
author: Caleb Bennett
status: evaluated
tags:
  - design
  - orders-import-format-adapters
---

# Orders Import — Format Adapters — Design

## Summary
Extend the existing `/api/import/orders` and `/api/import/plants` endpoints to accept the real-world annual files (`2026 Orders for Importing.xlsx`, `R1 Sales Offerings.xlsx`, `Sales by Product with flat totals.xlsx`) without modifying the handlers' business logic. A new `IImportFormatAdapter` layer translates source rows into the canonical schema the existing handlers already consume.

## Approach Selected
**Approach A — Format-aware adapters inside existing handlers.** Smallest surface area that satisfies the annual use case. New file shapes become new adapter classes; handler logic stays untouched.

## Architecture

```
 xlsx upload → ImportController → ImportService
                                     │
                                     ▼
                             ExcelRowReader
                             (skips blank leading rows,
                              normalizes headers)
                                     │
                                     ▼
                   FormatAdapterRegistry.Resolve(type, headers)
                                     │
                                     ▼
                   adapter.Map(rawRow) → canonicalRow
                                     │
                                     ▼
                  PlantImportHandler | OrderImportHandler
                           (unchanged core logic)
                                     │
                                     ▼
                       ImportBatch + ImportIssues persisted
```

## Components

- **`ExcelRowReader` + CSV reader refactor** (**replaces** the existing `ImportService.ReadXlsx` and `ImportService.ReadCsv` static helpers — not a parallel component). xlsx path opens via ClosedXML and scans to the first non-blank row as the header row (handles the blank row 1 in the 2026 file). CSV path does the same blank-leading-row skip before `CsvHelper` reads the header. Both paths **trim header names** before emitting. Existing validation errors that must be preserved: missing worksheet, duplicate header names, and (after blank-row skipping) blank header cells. Emits `(headers, rows[])` with trimmed string values. No schema knowledge.
- **`IImportFormatAdapter`** (new). `ImportType Type`, `string Name`, `IReadOnlyList<string> RequiredHeaders`, `bool Matches(IReadOnlyList<string> headers)`, `Dictionary<string,string> Map(Dictionary<string,string> rawRow)`. **`Matches` contract:** returns true iff every name in `RequiredHeaders` (case-insensitive, trimmed) is present in the detected headers. Extra headers are ignored. Canonical adapters declare the minimum canonical-required set; file-specific adapters declare their source-header set. See "Registry resolution" below for ordering.
- **`CanonicalOrdersAdapter`** / **`CanonicalPlantsAdapter`**: pass-through for the already-documented canonical schemas.
- **`HamptonHawks2026OrdersAdapter`**: maps `Order #, Name, Phone, Email, Seller, Item #, Qnty` to canonical. Splits `Name` and `Seller` on first space into First/Last; fills DisplayName with the full raw value. `IsWalkUp` always `"false"`.
- **`HamptonHawksR1PlantsAdapter`**: maps `Plant Name, Item number, Price` to canonical. Synthesizes `Barcode = "HH" + Sku.PadLeft(12,'0')`. `IsActive` always `"true"`. Extra columns from the "Sales by Product" file (`# per flat`, `Total Units`, `Total Sales`) are ignored, so the same adapter covers both plant files.
- **`FormatAdapterRegistry`** (new). Holds adapters grouped by `ImportType`. **Registry resolution:** file-specific adapters are tried **first** in registration order; canonical adapters are tried **last**; first match wins. On multi-match among file-specific adapters, a warning is logged and the first-registered wins (deterministic). If nothing matches, returns `UnknownFormat` (service records a `"UnknownFormat"` issue with the detected headers and marks the batch `Failed`).
- **PDF order import** (existing `ImportService.ReadOrdersPdf`). **Bypasses the adapter registry** — the PDF path already emits canonical order rows inline and will be handed directly to `OrderImportHandler` as it is today. `ImportBatch.SourceFormat` for PDF uploads is set to `"OrdersPdf"`. No behavior change for PDF uploads; covered by a regression acceptance criterion below.
- **`ImportService`** (existing, small change). Uses the reader + registry before calling the handler. Records the adapter name on `ImportBatch.SourceFormat`.
- **`ImportBatch`** (existing, schema change). New `SourceFormat` string column (nullable). One EF migration.
- **`ImportResultResponse`** (existing DTO, additive). New `sourceFormat` field.
- **Handlers** (existing, unchanged). Consume canonical rows exactly as they do today.

**Not owned:** adapters do no DB work or business validation; handlers are unaware of file shapes; the reader has no semantics.

## Data Flow

1. Admin POSTs file to `/api/import/plants` or `/api/import/orders` with existing query flags.
2. `ImportService` creates `ImportBatch` (Status=Running, SourceFormat=null).
3. `ExcelRowReader.Read(stream)` returns headers + raw rows (blank leading rows skipped).
4. `FormatAdapterRegistry.Resolve(type, headers)`:
   - no match → `Status=Failed`, single `"UnknownFormat"` issue listing detected headers.
   - match → `ImportBatch.SourceFormat = adapter.Name`.
5. For each raw row: `canonicalRow = adapter.Map(rawRow)`.
6. Existing handler processes the canonical rows, produces `(imported, skipped, issues)`.
7. Service persists batch + issues. If `dryRun=true`, transaction rolls back but counts/sourceFormat are returned.
8. Controller returns `ApiResponse<ImportResultResponse>` including `sourceFormat`.

### Transform specifics

**`HamptonHawks2026OrdersAdapter.Map`**
- `Order #` → `OrderNumber` (stringified).
- `Name` → split on first space → `CustomerFirstName`, `CustomerLastName`; full raw value → `CustomerDisplayName` (handles single-token names).
- `Seller` → same split into `SellerFirstName` / `SellerLastName` / `SellerDisplayName`.
- `Phone`, `Email` → passthrough.
- `Item #` → `Sku` (stringified).
- `Qnty` → `QtyOrdered`.
- `IsWalkUp` → `"false"`.

**`HamptonHawksR1PlantsAdapter.Map`**
- `Plant Name` → `Name`.
- `Item number` → `Sku` (stringified).
- `Price` → `Price`.
- `Barcode` → `"HH" + Sku.PadLeft(12,'0')` (e.g. `101` → `HH000000000101`).
- `IsActive` → `"true"`.
- Extra columns ignored.

## Error Handling

| Situation | Result |
|---|---|
| Corrupt / password-protected / empty-sheet file | `Failed` + `"FileUnreadable"` issue. No writes. |
| File entirely blank | `Failed` + `"EmptyFile"` issue. |
| Headers match no adapter | `Failed` + `"UnknownFormat"` issue listing detected headers. |
| Adapter throws on a specific row | Row-level `"MalformedRow"` issue with raw data; row skipped; import continues. |
| Unknown Sku / duplicate order number / missing customer name | Existing handler emits existing typed issues (unchanged). |
| `dryRun=true` | Wrapped in a transaction that always rolls back; counts returned. |

**Top three likely failure modes for this rollout**
1. **Source gains a new column next year.** `Matches` checks required headers only; extras are ignored. No code change needed for additive changes.
2. **Name without a space** (e.g. `"Cher"`). DisplayName always gets the full raw value, so the order still imports.
3. **Orders imported before plants.** Every line hits `"UnknownSku"` and is skipped; batch clearly reports zero imports; admin imports plants and retries. No corruption.

**Out of scope:** fuzzy header matching, concurrent-upload deduping, profile editing UI.

### Agent primitives
N/A — this is not an agentic system.

## Open Questions
None. (Barcode scheme locked to `"HH" + Sku.PadLeft(12,'0')`; `ImportBatch.SourceFormat` migration approved; `sourceFormat` in API response approved.)

## Approaches Considered
- **A — Format adapters in handlers (SELECTED).** Smallest change; fits annual-file use case; no new entities or UI. Lifts into B later if new formats proliferate.
- **B — Named import profiles (DB-stored column maps).** Rejected for now — meaningful extra surface area (entity, CRUD, UI, transform DSL) for two stable file shapes. Reconsider if ad-hoc third-party files appear.
- **C — Upload-and-map UI.** Rejected — manual every time, largest build, unnecessary when file shapes are stable year-over-year.

## Acceptance Criteria

These criteria define "done" and must all pass before the work ships.

1. **R1 plant file** — uploading `R1 Sales Offerings.xlsx` via `POST /api/import/plants` returns `success=true`, creates/upserts **95 plants** (matches the source row count), produces **0 issues**; every created plant has a non-null `Barcode` matching the regex `^HH\d{12}$` and `IsActive=true`.
2. **Sales-by-Product plant file** — uploading `Sales by Product with flat totals.xlsx` via the same endpoint is **idempotent with #1** (same plant set, 0 new rows on the second run with `upsertBySku=true`), and the extra columns (`# per flat`, `Total Units`, `Total Sales`) are silently ignored.
3. **2026 Orders file** — after the plant files are imported, uploading `2026 Orders for Importing.xlsx` via `POST /api/import/orders` groups rows by `Order #` into unique orders, produces **0 `UnknownSku` issues**, and every resulting `Order` has `IsWalkUp=false` and `Status=Open`.
4. **Canonical CSV/xlsx regression** — any CSV or xlsx matching the pre-existing canonical schema still imports successfully with the same counts as before the refactor.
5. **PDF regression** — an existing PDF order upload produces the **same** batch counts and order/line rows as before the refactor. `ImportBatch.SourceFormat` is set to `"OrdersPdf"`.
6. **Unknown format** — a file whose headers match no adapter results in `Status=Failed`, one `"UnknownFormat"` issue listing detected headers, zero rows persisted.
7. **SourceFormat visible** — `ImportResultResponse.sourceFormat` and `ImportBatch.SourceFormat` are populated with the adapter name (e.g. `"HamptonHawks2026Orders"`, `"HamptonHawksR1Plants"`, `"CanonicalOrders"`, `"OrdersPdf"`) for every non-failed batch.

## Commander's Intent

**Desired End State:** The three real-world annual files (`2026 Orders for Importing.xlsx`, `R1 Sales Offerings.xlsx`, `Sales by Product with flat totals.xlsx`) import end-to-end against the existing `/api/import/*` endpoints with the acceptance criteria above passing. Canonical and PDF inputs remain regression-free. `ImportBatch` records which adapter handled each file.

**Purpose:** Hampton Hawks receives these shapes once per sale season. Today the importer rejects them on header mismatch, forcing manual CSV reshaping. A thin adapter layer lets the annual files be dropped in as-is, with a clean extension point for the next year's shape.

**Constraints:**
- **MUST NOT** modify `OrderImportHandler` or `PlantImportHandler` business logic. The canonical row shape they consume today is frozen by this work.
- **MUST NOT** break the existing canonical CSV/xlsx path or the PDF order path.
- **MUST** add exactly one EF migration: `ImportBatch.SourceFormat` (nullable string).
- **MUST** follow the repo's response envelope (`ApiResponse<T>`) and kebab-case route conventions — no new endpoints are required; only the existing ones are reused.
- **MUST** add adapters under `api/src/HamptonHawksPlantSales.Infrastructure/Services/ImportAdapters/` (one class per adapter).

**Freedoms:** The implementing agent MAY:
- Choose the internal class shape of `ExcelRowReader` and private helpers.
- Pick exact log-message wording for `UnknownFormat` and multi-match warnings.
- Add integration-test fixtures under `api/tests/Fixtures/Import/` using trimmed copies of the real files.
- Register adapters via DI or via a static registry — whichever matches existing `Infrastructure/Services` conventions best.
- Place unit tests in the existing `api/tests/HamptonHawksPlantSales.Tests/` project under an `Import/` folder.

## Execution Guidance

**Observe:**
- `dotnet build HamptonHawksPlantSales.sln` — zero errors.
- `dotnet test HamptonHawksPlantSales.sln` — all green, including new integration tests.
- For each acceptance criterion, run the actual file through a `dryRun=true` test harness first, then a real run.

**Orient (codebase conventions to follow):**
- Services live in `Infrastructure/Services/`; interfaces in `Core/Interfaces/`; DTOs in `Core/DTOs/`; models in `Core/Models/`.
- One `IEntityTypeConfiguration<T>` per entity under `Infrastructure/Data/Configurations/`.
- DI registration in `Program.cs` — match the pattern used by existing import-related registrations.
- EF migrations generated via `dotnet ef migrations add <Name> --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api`.
- `ImportBatch.SourceFormat` is additive; existing batches read as `null` (no backfill needed).

**Escalate When:**
- A handler signature change looks necessary — stop and ask. The whole point of adapters is that handlers don't change.
- The synthesized `HH` + 12-digit barcode collides with an existing plant barcode — stop and ask how to resolve.
- PDF path behavior diverges under the refactor — stop and ask rather than "fixing" PDF.
- The 2026 orders file produces any `UnknownSku` after plants are imported — investigate (do not mass-assume a new sku scheme).

**Shortcuts (apply without deliberation):**
- Use `ClosedXML` for xlsx (already referenced in `ImportService`); reuse the existing shared-strings/validation error patterns from `ReadXlsx`.
- Use `CsvHelper` for CSV (already referenced).
- Use the existing `ImportIssue` model for all per-row errors — do not invent a new error type.
- Return `ApiResponse<T>.Ok(...)` on success; controllers stay thin (already the pattern).
- Test file naming: `{ComponentName}Tests.cs` under `api/tests/HamptonHawksPlantSales.Tests/Import/`.

## Decision Authority

**Agent Decides Autonomously:**
- Folder and class layout under `Infrastructure/Services/ImportAdapters/`.
- Internal helper methods, private types, adapter class names.
- Log message wording for `UnknownFormat` and multi-match warnings.
- Unit-test case organization and naming.

**Agent Recommends, Human Approves:**
- The EF migration name and the exact column type/length for `ImportBatch.SourceFormat`.
- Adding `sourceFormat` to `ImportResultResponse` (additive, non-breaking but public).
- PDF routing choice (the plan locks: PDF bypasses the registry; flag if a different approach is preferred during implementation).
- Deleting the existing `ReadXlsx`/`ReadCsv` static helpers vs. leaving thin back-compat shims.

**Human Decides:**
- Barcode synthesis format change (locked here as `HH` + `Sku.PadLeft(12,'0')`).
- Whether to accept or reject files whose headers are a superset of a known format but also match another (currently: first-registered wins + warning).
- Any scope expansion (e.g. adding order `Notes`/`OrderDate` flow).

## War-Game Results

- **Most Likely Failure:** Orders file is imported before plants → every line emits `UnknownSku`, zero orders created. **Mitigation:** acceptance criterion #3 runs plants first; error surface is already clear. No code change needed.
- **Scale Stress:** 2,670 rows × ~95 plants in a dictionary is trivial. Not a concern at the current scope.
- **Dependency Risk:** ClosedXML on the 2026 file's blank row 1 — mitigated by the explicit "scan to first non-blank row" rule; covered by an integration test fixture.
- **Maintenance Assessment:** A developer six months from now adds next year's file by creating one adapter class and registering it. Adapters are self-describing and small. Good.

## Evaluation Metadata
- Evaluated: 2026-04-14
- Cynefin Domain: Complicated
- Critical Gaps Found: 2 (2 resolved)
- Important Gaps Found: 3 (3 resolved)
- Suggestions: 3 (folded into acceptance criteria and execution guidance)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-14-orders-import-format-adapters-design.md`)
- [ ] Add EF migration for `ImportBatch.SourceFormat`
- [ ] Confirm CSV path still works (canonical adapters must accept both xlsx and csv inputs)
