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
```

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
`IInventoryProtectionService` calculates: `AvailableForWalkup = OnHandQty - SUM(preorder unfulfilled qty)`. Both `/api/walkup/` and `/api/orders/` routes must enforce this for walk-up orders.

### Naming Conventions
- C# Backend: PascalCase for public members, camelCase for JSON serialization
- TypeScript Frontend: camelCase for variables/functions, PascalCase for types/components
- API routes: kebab-case (`/api/admin-actions`, `/api/walkup/availability`)

### DTOs
All in `Core/DTOs/`. Request DTOs for input, Response DTOs for output. Map manually or use mapping extensions.

### Validation
FluentValidation for request DTOs. Validators in `Core/Validators/`.
