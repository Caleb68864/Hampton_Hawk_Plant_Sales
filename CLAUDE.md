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

Most API unit tests use EF InMemory (`MockDbContextFactory`), which enforces
neither unique indexes, FKs, check constraints, row locks nor transactions.
Deleting the unique index on `Customer.PicklistBarcode` leaves 534 of 535 tests
green — that is the size of the blind spot, and it is how a filtered unique
index shipped with nothing assigning a value.

For anything that depends on a constraint, use `ConstraintEnforcingDbContext`
(`Helpers/`), which builds the same model on SQLite and does enforce unique
indexes, partial indexes and check constraints. It is still not Postgres: no
`SELECT ... FOR UPDATE`, no SERIALIZABLE retries, no 23505 codes, no `jsonb` or
collation semantics. Every file using it carries a control test asserting the
provider really rejects a duplicate, so it cannot quietly become a suite that
proves nothing.

Row locks, SERIALIZABLE retries and SQLSTATE handling are tested against real
Postgres in `api/tests/HamptonHawksPlantSales.PostgresTests` (Testcontainers,
`postgres:16`, schema from the real migrations, fresh database per test). Those
tests are `[PostgresFact]`s that skip unless `HH_POSTGRES_TESTS=1`, so a plain
`dotnet test` works without Docker. CI's `api-postgres` job sets the variable
and fails if any of them is skipped. Since 2026-11-16 Docker is reachable here,
so run them locally with `HH_POSTGRES_TESTS=1` (plus `DOTNET_ROLL_FORWARD=Major`
on a .NET-10-only machine). A change to the scan, register
or inventory write paths, or to `WalkUpRowLocks`/`WalkUpOrderNumbers`, is only
checked once that job has run.

Two-station races there are staged with `Interleave.RunAsync`. It holds station
A just before it writes the stock back, runs station B until B finishes or
queues on a lock, and then releases A. `HarnessControlTests` proves the harness
really overlaps transactions: through it, an unlocked read-modify-write must
lose an update. If you add a race test, stage it the same way. Two operations
run one after the other prove nothing about locking.

`docker compose up --build` (Compose v2.24+, for the `!override` tag in
`docker-compose.override.yml`) is exercised by CI's `compose` job. It probes
the API, the web proxy, a real login, and container health, then runs the
Playwright specs in `.e2e/` (their own `package.json`) in Chromium against that
stack: `imports-reports.spec.ts` (uploads plants, inventory and orders, sells
some, and reads the numbers back from the reports in America/Chicago),
`route-crawl.spec.ts` (opens every route in `web/src/App.tsx` and fails if a
route is added without a crawl entry), then `sale-day.spec.ts`. The specs log in
7 times (imports 1, crawl 1, sale-day 5); with the job's bootstrap-login and
flag-off steps that is 9 before the api is recreated, against a login limiter of
10/min per IP, so the job has room for one more login at most.
`docs/improve/2026-08-29-sweep-report.md` describes the browser E2E harness
(Postgres in Docker + `dotnet run` + `vite preview` + Playwright); run it before
a sale-day release.

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

Every stock write path takes its row locks in one canonical order, defined (with
the reasons) on `WalkUpRowLocks`: ScanSessions, then per plant in ascending
`PlantCatalogId` PlantCatalogs -> Inventories -> that plant's OrderLines, then
Orders, then FulfillmentEvents. Take the plant lock first even when the plant
row is not written: inserting an event, adjustment or line takes `FOR KEY SHARE`
on it for the FK check. Use the helpers (`AcquireAsync`, `LockPlantAsync`,
`LockOrderLinesAsync`, `LockOrdersAsync`) rather than hand-written `FOR UPDATE`,
and sort in C#, not SQL. `LockOrderRaceTests` stages each formerly inverted pair;
a new write path needs a test there.

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
