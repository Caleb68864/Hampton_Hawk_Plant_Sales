---
type: phase-spec
sub_spec: 1
title: "Project Scaffolding + Docker + Database Schema"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: none
---

# Sub-Spec 1: Project Scaffolding + Docker + Database Schema

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md) for full context, edge cases, and requirements. Reference `spec.md` at repo root for detailed data model (Section 4), Docker config (Section 16), and project structure (Section 2.4).

**Tech:** .NET 10, EF Core, Npgsql, Serilog, Swashbuckle | React, Vite, TypeScript (strict), Tailwind CSS | PostgreSQL 16 | Docker Compose

**Conventions:** UUID PKs, `timestamptz` timestamps, soft delete via `DeletedAt`, business logic in services not controllers.

---

## Implementation Steps

### Step 1: Create .NET Solution + API Project

**Create:**
- `/api/HamptonHawksPlantSales.sln`
- `/api/src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj`
- `/api/src/HamptonHawksPlantSales.Api/Program.cs`
- `/api/src/HamptonHawksPlantSales.Core/HamptonHawksPlantSales.Core.csproj`
- `/api/src/HamptonHawksPlantSales.Infrastructure/HamptonHawksPlantSales.Infrastructure.csproj`
- `/api/tests/HamptonHawksPlantSales.Tests/HamptonHawksPlantSales.Tests.csproj`

**Details:**
- API project targets `net10.0`
- API references Core; Infrastructure references Core; Tests references all
- Program.cs: minimal API setup with Serilog, Swagger (dev only), health checks at `/health`, CORS for `http://localhost:3000`
- NuGet packages: `Npgsql.EntityFrameworkCore.PostgreSQL`, `FluentValidation.AspNetCore`, `Serilog.AspNetCore`, `Swashbuckle.AspNetCore`, `Microsoft.AspNetCore.Diagnostics.HealthChecks`
- Health check: basic + DB health check via `AspNetCore.HealthChecks.NpgsqlN`
- Read connection string from `ConnectionStrings__Default`
- Read `APP_ADMIN_PIN` from env var

**Verify:**
```bash
cd api && dotnet build
```

---

### Step 2: Create Domain Models + Enums (Core)

**Create in `/api/src/HamptonHawksPlantSales.Core/Models/`:**
- `AppSettings.cs` -- Id (Guid), SaleClosed (bool), SaleClosedAt (DateTimeOffset?), CreatedAt, UpdatedAt, DeletedAt
- `PlantCatalog.cs` -- Id, Sku, Name, Variant, Price (decimal?), Barcode, BarcodeLockedAt, IsActive, timestamps
- `Inventory.cs` -- Id, PlantCatalogId (FK), OnHandQty, timestamps
- `InventoryAdjustment.cs` -- Id, PlantCatalogId, DeltaQty, Reason, Notes, CreatedAt, DeletedAt
- `Seller.cs` -- Id, FirstName, LastName, DisplayName, Grade, Teacher, Notes, timestamps
- `Customer.cs` -- Id, FirstName, LastName, DisplayName, Phone, Email, PickupCode, Notes, timestamps
- `Order.cs` -- Id, CustomerId, SellerId?, OrderNumber, Status (enum), IsWalkUp, HasIssue, timestamps
- `OrderLine.cs` -- Id, OrderId, PlantCatalogId, QtyOrdered, QtyFulfilled, Notes, timestamps
- `FulfillmentEvent.cs` -- Id, OrderId, PlantCatalogId?, Barcode, Result (enum), Message, CreatedAt, DeletedAt
- `ImportBatch.cs` -- Id, Type (enum), Filename, TotalRows, ImportedCount, SkippedCount, CreatedAt, DeletedAt
- `ImportIssue.cs` -- Id, ImportBatchId, RowNumber, IssueType, Barcode, Sku, Message, RawData (string/jsonb), CreatedAt, DeletedAt
- `AdminAction.cs` -- Id, ActionType, EntityType, EntityId, Reason, Message, CreatedAt, DeletedAt

**Create in `/api/src/HamptonHawksPlantSales.Core/Enums/`:**
- `OrderStatus.cs` -- Open, InProgress, Complete, Cancelled
- `FulfillmentResult.cs` -- Accepted, NotFound, WrongOrder, AlreadyFulfilled, SaleClosedBlocked, OutOfStock
- `ImportType.cs` -- Plants, Orders, Inventory

**Conventions:**
- All models inherit from a `BaseEntity` with Id (Guid), CreatedAt, UpdatedAt, DeletedAt
- Exception: FulfillmentEvent, ImportBatch, ImportIssue, InventoryAdjustment, AdminAction have CreatedAt + DeletedAt only (no UpdatedAt)

**Verify:**
```bash
cd api && dotnet build
```

---

### Step 3: Create EF Core DbContext + Entity Configurations (Infrastructure)

**Create:**
- `/api/src/HamptonHawksPlantSales.Infrastructure/Data/AppDbContext.cs`
- `/api/src/HamptonHawksPlantSales.Infrastructure/Data/Configurations/` -- one config file per entity

**Details:**
- DbContext with DbSet for each entity
- Entity configurations:
  - PlantCatalog: unique index on Sku, unique index on Barcode
  - Inventory: unique index on PlantCatalogId (1:1 with PlantCatalog)
  - Customer: unique index on PickupCode, index on LastName, Phone
  - Seller: index on LastName, DisplayName
  - Order: unique index on OrderNumber, index on CustomerId, SellerId
  - OrderLine: index on OrderId, PlantCatalogId, CHECK constraint `QtyFulfilled <= QtyOrdered`
  - FulfillmentEvent: index on OrderId, PlantCatalogId
  - ImportIssue: index on ImportBatchId
  - AdminAction: no special indexes needed
- All string columns use `text` type (PostgreSQL)
- Price is `numeric(10,2)`
- RawData on ImportIssue is `jsonb`
- Global query filter for soft delete: `.HasQueryFilter(e => e.DeletedAt == null)` on all entities
- Auto-set CreatedAt/UpdatedAt in SaveChangesAsync override

**Verify:**
```bash
cd api && dotnet build
```

---

### Step 4: Create Initial EF Core Migration

**Run:**
```bash
cd api/src/HamptonHawksPlantSales.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../HamptonHawksPlantSales.Api
```

**Verify:** Migration files created in `Migrations/` folder.

---

### Step 5: Seed AppSettings Row

**Create:**
- Data seeding in DbContext `OnModelCreating` or a separate `DataSeeder.cs`
- Seed a single AppSettings row with `SaleClosed = false`

**Verify:**
```bash
cd api && dotnet build
```

---

### Step 6: Create React/Vite/TypeScript/Tailwind Project

**Create `/web/` directory with:**
```bash
cd web && npm create vite@latest . -- --template react-ts
npm install tailwindcss @tailwindcss/vite react-router-dom zustand axios
npm install -D eslint prettier typescript @types/react @types/react-dom
```

**Configure:**
- `vite.config.ts`: API proxy to `http://localhost:8080` for `/api/*`, tailwind plugin
- `tailwind.config.js`: content paths, custom colors for status chips
- `tsconfig.json`: strict mode, path aliases (`@/` → `src/`)
- Basic `App.tsx` with "Hampton Hawks Plant Sales" heading
- `index.css`: Tailwind directives

**Verify:**
```bash
cd web && npm run build
```

---

### Step 7: Create API Dockerfile (Multi-Stage)

**Create `/api/Dockerfile`:**
- Stage 1: `mcr.microsoft.com/dotnet/sdk:10.0` -- restore, build, publish
- Stage 2: `mcr.microsoft.com/dotnet/aspnet:10.0` -- copy published output, expose 8080
- Entry point runs migrations at startup then starts the app
- Migration at startup: use `Database.MigrateAsync()` in Program.cs before `app.Run()`

**Verify:** Dockerfile syntax valid (will be tested with docker-compose).

---

### Step 8: Create Web Dockerfile (Multi-Stage + nginx)

**Create `/web/Dockerfile`:**
- Stage 1: `node:22-alpine` -- npm install, npm run build
- Stage 2: `nginx:alpine` -- copy dist to `/usr/share/nginx/html`
- Create `/web/nginx.conf`: SPA fallback (`try_files $uri $uri/ /index.html`), listen on port 80

**Verify:** Dockerfile syntax valid.

---

### Step 9: Create docker-compose.yml

**Create `/docker-compose.yml`:**
- Match the reference implementation from spec Section 16.1 exactly
- postgres: image postgres:16, healthcheck, volume
- api: build ./api, env vars (ConnectionStrings__Default, APP_ADMIN_PIN, ASPNETCORE_URLS, ASPNETCORE_ENVIRONMENT), depends_on postgres healthy, port 8080
- web: build ./web, depends_on api, port 3000:80

**Verify:**
```bash
docker-compose config
```

---

### Step 10: Full Docker Compose Up Test

**Run:**
```bash
docker-compose up -d --build
```

**Verify:**
```bash
# All services running
docker-compose ps

# API health check
curl http://localhost:8080/health

# Web serves SPA
curl -s http://localhost:3000 | head -5

# Database has tables
docker-compose exec postgres psql -U plantapp -d hampton_hawks_plant_sales -c "\dt"
```

**Expected:** 3 services up, health check returns healthy, web returns HTML, psql shows all 12 tables (11 entities + EF migrations history).

---

## Interface Contracts

### Provides (for all other sub-specs):

**Database:**
- PostgreSQL with all 12 tables created and indexed
- AppSettings seeded with SaleClosed=false
- Soft delete query filters active globally

**API Project Structure:**
- `AppDbContext` registered in DI
- Health check at `/health`
- Swagger at `/swagger` (dev)
- CORS configured for web origin
- Serilog JSON logging
- Connection string from `ConnectionStrings__Default`
- Admin PIN from `APP_ADMIN_PIN`

**Domain Models:**
- All 12 entity classes in `HamptonHawksPlantSales.Core.Models`
- All 3 enums in `HamptonHawksPlantSales.Core.Enums`
- `BaseEntity` base class with Id, CreatedAt, UpdatedAt, DeletedAt

**Web Project Structure:**
- Vite + React + TypeScript configured with Tailwind
- API proxy configured for development
- Basic App.tsx rendering

**Docker:**
- `docker-compose up` brings up all 3 services
- API at port 8080, Web at port 3000, Postgres at 5432

### Requires: nothing (foundation sub-spec)

### Shared State:
- `/api/src/HamptonHawksPlantSales.Infrastructure/Data/AppDbContext.cs` -- used by all API sub-specs
- `/api/src/HamptonHawksPlantSales.Core/Models/` -- used by all API sub-specs
- `/web/src/App.tsx` -- modified by sub-spec 7

---

## Verification Commands

**Build check:**
```bash
cd api && dotnet build && cd ../web && npm run build
```

**Docker check:**
```bash
docker-compose up -d --build && docker-compose ps && curl http://localhost:8080/health
```

**Database check:**
```bash
docker-compose exec postgres psql -U plantapp -d hampton_hawks_plant_sales -c "\dt"
```

**Acceptance criteria checklist:**
1. `docker-compose up` starts all 3 services -- check `docker-compose ps`
2. API health check -- `curl http://localhost:8080/health` returns healthy
3. All tables exist -- psql `\dt` shows 12 tables
4. UUID PKs + timestamps -- psql `\d "PlantCatalog"` shows correct column types
5. Web serves SPA -- `curl http://localhost:3000` returns HTML
6. Builds succeed -- `dotnet build` and `npm run build` both exit 0
