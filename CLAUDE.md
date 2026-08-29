# Hampton Hawks Plant Sales

## Tech Stack
- **API:** .NET 9 / ASP.NET Core, EF Core 9 + Npgsql (PostgreSQL 16), FluentValidation, Serilog, CsvHelper, ClosedXML
- **Web:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, React Router v7, Zustand 5, Axios
- **Infra:** Docker Compose (postgres, api, web)

## Project Structure
```
api/
  src/HamptonHawksPlantSales.Api/           # Controllers, filters, middleware, Program.cs
  src/HamptonHawksPlantSales.Core/          # Models, interfaces, DTOs, validators, enums
  src/HamptonHawksPlantSales.Infrastructure/ # EF Core, services, migrations, data config
  tests/HamptonHawksPlantSales.Tests/       # xUnit + Moq + FluentAssertions
web/
  src/pages/        # Route pages
  src/components/   # Shared + feature components
  src/api/          # Axios API client layer
  src/stores/       # Zustand stores
  src/types/        # TypeScript types
```

## Build & Test
```bash
# Build API
cd api && dotnet build HamptonHawksPlantSales.sln

# Run tests
cd api && dotnet test HamptonHawksPlantSales.sln

# EF migrations
dotnet ef migrations add <Name> --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api

# Web
cd web && npm install && npm run build
cd web && npm test          # node:test (src/**/*.test.ts outside __tests__/) then vitest (__tests__/)
cd web && npm run lint      # must stay at 0 problems
```

Web test placement: pure-logic tests sit next to their module as `*.test.ts`
(node:test, no DOM); anything that renders or imports `.tsx` goes under
`__tests__/` (vitest + jsdom). `scripts/run-node-tests.mjs` globs the former.

The API unit tests use EF InMemory, which enforces neither unique indexes, FKs,
row locks nor transactions — bugs of that class only show against Postgres.
`docs/improve/2026-08-29-sweep-report.md` describes the browser E2E harness
(Postgres in Docker + `dotnet run` + `vite preview` + Playwright) used to catch
them; run it before a sale-day release.

## Architecture Rules

### Response Envelope
ALL endpoints return `ApiResponse<T>`: `{ success, data, errors }`. Use `ApiResponse<T>.Ok(result)` for success, `ApiResponse<T>.Fail(message)` for errors. Return `Ok(...)` (HTTP 200) for all successful operations including creates.

### Controller Pattern
Controllers are thin -- call service, return envelope. No business logic in controllers.

### Admin PIN Authorization
Use `[RequiresAdminPin]` attribute on controller actions. `AdminPinActionFilter` validates `X-Admin-Pin` and `X-Admin-Reason` headers. Access validated reason via `HttpContext.Items["AdminReason"]`.

### Soft Delete
All entities extend `BaseEntity` (`Id`, `CreatedAt`, `UpdatedAt`, `DeletedAt`). EF global query filters exclude deleted records. Use `.IgnoreQueryFilters()` when `includeDeleted=true`.

### Service Layer
All business logic in `Infrastructure/Services/`. Interfaces in `Core/Interfaces/`. Registered via DI in `Program.cs`.

### EF Configuration
One `IEntityTypeConfiguration<T>` per entity in `Infrastructure/Data/Configurations/`. Applied via `ApplyConfigurationsFromAssembly`.

### Concurrency
Use `BeginTransactionAsync()` + raw SQL `SELECT ... FOR UPDATE` for row-level locking on concurrent operations (scan fulfillment).

### Walk-Up Inventory Protection
`IInventoryProtectionService` calculates:
`AvailableForWalkup = OnHandQty - SUM(unfulfilled qty across ALL non-cancelled orders)`.
Both `/api/walkup/` and `/api/orders/` routes must enforce this for walk-up orders.

Deduct **every** outstanding commitment, preorder and walk-up alike -- not just
preorders. A walk-up line does not decrement `OnHandQty` until fulfillment, so
counting only preorders made walk-up demand invisible to its own availability
check and the same unit could be sold repeatedly (confirmed against Postgres:
three sequential adds against one unit on hand all succeeded).

Deduct only the *unfulfilled* remainder. Fulfilled quantities already came out of
`OnHandQty`, and subtracting them again would double-count. This is what lets one
formula serve both flows: the walk-up register decrements inventory at scan time
and writes `QtyOrdered == QtyFulfilled`, so its sales contribute nothing to the
deduction.

Walk-up order writes take row locks before validating -- see `WalkUpRowLocks`.
Serializable conflicts are expected under concurrent registers and are retried
with jittered backoff rather than surfaced to the volunteer.

### Naming Conventions
- C# Backend: PascalCase for public members, camelCase for JSON serialization
- TypeScript Frontend: camelCase for variables/functions, PascalCase for types/components
- API routes: kebab-case (`/api/admin-actions`, `/api/walkup/availability`)

### DTOs
All in `Core/DTOs/`. Request DTOs for input, Response DTOs for output. Map manually or use mapping extensions.

### Validation
FluentValidation for request DTOs. Validators in `Core/Validators/`.
