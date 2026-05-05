# Hampton Hawks Plant Sales

Hampton Hawks Plant Sales is a full-stack fundraiser operations app for running a school plant sale from data import through pickup day. It combines a React frontend, an ASP.NET Core API, and PostgreSQL so staff and volunteers can manage plants, inventory, customers, sellers, orders, kiosk stations, printing, and closeout workflows from one system.

The app is built around real event operations:
- import plant catalog, inventory, and preorder data
- monitor problem orders and inventory risk
- run pickup and lookup/print stations
- create walk-up orders with live stock protection
- print order sheets, seller packets, labels, and station guides
- lock volunteer devices into kiosk-safe workflows

## Table of Contents

- [System Overview](#system-overview)
- [Current Routes](#current-routes)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Local Development](#local-development)
- [Build Test and Tooling](#build-test-and-tooling)
- [Configuration](#configuration)
- [Authentication and User Roles](#authentication-and-user-roles)
- [Operational Workflows](#operational-workflows)
- [Kiosk Mode](#kiosk-mode)
- [Sale Closed Behavior](#sale-closed-behavior)
- [Admin-Protected Actions](#admin-protected-actions)
- [Help and Print Surfaces](#help-and-print-surfaces)
- [Repository Structure](#repository-structure)
- [Troubleshooting](#troubleshooting)
- [Maintainer Notes](#maintainer-notes)

## System Overview

The application supports the full operating cycle of a plant fundraiser.

Core capabilities:
- plant catalog management
- inventory management and adjustments
- customer and seller lookup
- order import and manual order management
- barcode-based pickup fulfillment
- volunteer-safe kiosk mode for station devices
- walk-up order creation with availability checks and admin overrides
- printable operational paperwork and cheat sheets
- dashboard and reporting views for supervisors

## Current Routes

### Authentication routes

| Route | Purpose |
|---|---|
| `/login` | Login page — all unauthenticated users are redirected here |
| `/admin/users` | User management (Admin only) |

### Main app routes

| Route | Purpose |
|---|---|
| `/` | Dashboard with metrics, low inventory, problem orders, and quick links |
| `/settings` | Global sale controls and browser-local kiosk configuration |
| `/plants` | Plant catalog list |
| `/plants/:id` | Plant detail and edit view |
| `/inventory` | Inventory management |
| `/customers` | Customer list and lookup |
| `/customers/:id` | Customer detail |
| `/sellers` | Seller list and lookup |
| `/sellers/:id` | Seller detail |
| `/orders` | Order list |
| `/orders/new` | New manual order |
| `/orders/:id/edit` | Edit an order |
| `/orders/:id` | Order detail |
| `/station` | Station launcher |
| `/pickup` | Pickup lookup station |
| `/pickup/:orderId` | Pickup scan screen for a single order |
| `/lookup-print` | Volunteer-safe lookup and print station |
| `/walkup/new` | Walk-up order creation |
| `/imports` | Imports and import history |
| `/reports` | Reporting dashboard |
| `/reports/leftover-inventory` | Leftover inventory report |
| `/docs` | Volunteer Help Center |

### Print routes

| Route | Purpose |
|---|---|
| `/print/order/:orderId` | Printable customer order sheet |
| `/print/orders` | Batch order print output |
| `/print/seller/:sellerId` | Seller packet print view |
| `/print/labels` | Plant label printing |
| `/print/cheatsheet/pickup` | Pickup station one-page guide |
| `/print/cheatsheet/lookup` | Lookup and print one-page guide |
| `/print/cheatsheet/admin` | Admin actions guide |
| `/print/cheatsheet/end-of-day` | End-of-day checklist |
| `/print/cheatsheet/thermal-labels` | Thermal printer quick setup |

## Architecture

### Frontend

The frontend lives in `web/` and uses:
- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- React Router 7
- Zustand

Important frontend pieces:
- `AppLayout` provides the normal full-app shell.
- `KioskLayout` replaces the normal shell when kiosk mode is active for the current browser.
- `KioskRouteGuard` keeps kiosk sessions inside allowed routes.
- `GlobalQuickFind` and `QuickFindOverlay` support fast navigation.
- print routes sit outside the normal shell so print views stay focused.

### Backend

The backend lives in `api/` and uses:
- ASP.NET Core 9
- Entity Framework Core 9
- PostgreSQL 16
- FluentValidation
- Serilog
- Swagger/OpenAPI

Project layout:
- `api/src/HamptonHawksPlantSales.Api`
- `api/src/HamptonHawksPlantSales.Core`
- `api/src/HamptonHawksPlantSales.Infrastructure`
- `api/tests/HamptonHawksPlantSales.Tests`

Current API controllers:
- `AdminActionsController`
- `AuthController`
- `CustomersController`
- `FulfillmentController`
- `ImportController`
- `InventoryController`
- `OrdersController`
- `PlantsController`
- `ReportsController`
- `SellersController`
- `SettingsController`
- `UsersController`
- `VersionController`
- `WalkUpController`

Operational backend behaviors:
- EF Core migrations run automatically on startup.
- Health checks are exposed at `/health`.
- Swagger is enabled in Development.
- admin-protected actions are enforced centrally through a filter.
- JSON uses camelCase and string enums.

## Quick Start

### Run the full stack with Docker Compose

```bash
docker-compose up --build
```

This starts:

| Service | URL / Port | Notes |
|---|---|---|
| Web UI | http://localhost:3000 | Served by nginx |
| API | http://localhost:8080 | ASP.NET Core API |
| Swagger | http://localhost:8080/swagger | Development only |
| PostgreSQL | localhost:5432 | Database |

Default local compose values:
- database: `hampton_hawks_plant_sales`
- username: `plantapp`
- password: `plantapp`
- admin PIN: `1234`

### Portainer deployment

If you want Portainer to deploy only the API and PostgreSQL containers, use:

- `docker-compose.portainer.yml`

Typical Portainer flow:
1. Create a new stack from repository.
2. Point it at this repo.
3. Set the compose path to `docker-compose.portainer.yml`.
4. Override production environment variables.
5. Deploy the stack.

Post-deploy checks:
- health: `http://<host>:<APP_PORT>/health`
- Swagger: `http://<host>:<APP_PORT>/swagger` when running in Development

## Local Development

### Prerequisites

- .NET 9 SDK
- Node.js 22+ recommended
- npm
- Docker Desktop or PostgreSQL 16

### Run using Docker for the database and local app processes

1. Start PostgreSQL:

```bash
docker-compose up postgres -d
```

2. Start the API:

```bash
cd api
dotnet run --project src/HamptonHawksPlantSales.Api
```

3. Start the web app in a second terminal:

```bash
cd web
npm install
npm run dev
```

Expected local URLs:
- web: `http://localhost:3000`
- api: `http://localhost:8080`

### Run everything in containers

```bash
docker-compose up --build
```

## Build Test and Tooling

### Frontend commands

```bash
cd web
npm install
npm run build
npm run test
npm run lint
```

Available scripts:
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
- `npm run test`
- `npm run storybook`
- `npm run build-storybook`
- `npm run docs`

### Backend tests

Run the full .NET solution test suite from the repo root:

```bash
run-tests.bat
```

Or directly:

```bash
cd api
dotnet test HamptonHawksPlantSales.sln
```

### Storybook

```bash
cd web
npm run storybook
```

Storybook URL:
- `http://localhost:6006`

### TypeDoc

```bash
cd web
npm run docs
```

Generated output goes to:
- `web/docs-output/`

## Configuration

### API environment variables

| Variable | Description | Default |
|---|---|---|
| `ConnectionStrings__Default` | PostgreSQL connection string | required outside local defaults |
| `APP_ADMIN_PIN` | Admin PIN for protected actions | `1234` |
| `INVENTORY_NEGATIVE_ADJUST_THRESHOLD` | Negative adjustment threshold guard | `10` |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET environment | `Production` in Docker |
| `ASPNETCORE_URLS` | API listen address | `http://+:8080` |
| `Cors__AllowedOrigins` | Comma-separated CORS allowlist | `http://localhost:3000` |
| `Bootstrap__AdminUsername` | Username for the auto-created first admin | (not set — skipped if empty) |
| `Bootstrap__AdminPassword` | Password for the auto-created first admin | (not set — skipped if empty) |

### CORS

The API uses an explicit allowlist and does not use wildcard origins.

Example `appsettings.json` structure:

```json
{
  "Cors": {
    "AllowedOrigins": [
      "https://plantsales.hamptonhawks.org",
      "https://plantsales-admin.hamptonhawks.org"
    ]
  }
}
```

Equivalent environment variable:

```bash
Cors__AllowedOrigins=https://plantsales.hamptonhawks.org,https://plantsales-admin.hamptonhawks.org
```

## Authentication and User Roles

The app requires authenticated accounts. All routes redirect to `/login` for unauthenticated users.

### Roles

| Role | Access |
|---|---|
| `Admin` | Full access including user management and settings |
| `Pickup` | Pickup lookup and scan station |
| `LookupPrint` | Lookup and print station |
| `POS` | Walk-up order creation |
| `Reports` | Dashboard and reporting views |

Users can hold multiple roles. Assign station accounts the minimum role needed for their job.

Recommended station account names match physical devices at the event: `Pickup1`, `Pickup2`, `POS2`, `POS3`, `LookupPrint1`. This makes logs readable during the sale.

### First-Admin Bootstrap

On first startup the API reads `Bootstrap__AdminUsername` and `Bootstrap__AdminPassword` from configuration. If no admin exists it creates one automatically. Repeated restarts with the same values do not create duplicates.

Local Docker Compose default values (change before a real deployment):

```
Bootstrap__AdminUsername=admin
Bootstrap__AdminPassword=changeme
```

For production use, set these via environment variable overrides or a `.env` file. Never leave the default password in production.

### Creating Station Accounts

1. Log in as Admin.
2. Navigate to **Settings → User Management**.
3. Click **Create User** and assign a role.
4. Share credentials with the volunteer or tape them to the device.

### API Authorization

Protected endpoints require an authenticated session (HTTP-only cookie). Unauthenticated requests return `401`. Requests from an authenticated user without the required role return `403`.

Print routes are accessible to authenticated users with desktop roles and do not require separate re-authentication. This keeps existing print workflows intact.

### Configuration Variables

| Variable | Description | Default |
|---|---|---|
| `Bootstrap__AdminUsername` | Username for the auto-created first admin | (not set) |
| `Bootstrap__AdminPassword` | Password for the auto-created first admin | (not set) |

If either variable is empty the bootstrap step is skipped. In that case you must seed an admin account via a database migration or a manual insert before the app is usable.

## Operational Workflows

### Import data

Use the **Imports** page to load fundraiser data.

Current import surfaces:
- plants import
- inventory import
- orders import
- import history
- issue review for skipped rows

Supported import behavior currently exposed in the UI:
- plants import from CSV template workflow
- inventory import
- orders import from CSV, XLSX, or supported order PDF input
- duplicate order-number confirmation for some order import conflicts
- label printing shortcut after successful plant import

### Monitor operations

Use **Dashboard** and **Reports** for live visibility.

Dashboard shows:
- total orders
- open orders
- completed orders
- customer count
- seller count
- sale progress
- low inventory panel
- problem orders panel
- quick links to common actions

Reports adds:
- order status distribution
- performance snapshot
- critical inventory risk ranking
- oldest problem orders
- leftover inventory reporting entry point

### Run pickup

Pickup is a two-step workflow.

1. `/pickup`
- search by customer name
- search by order number
- search by pickup code
- browse by A-Z tabs

2. `/pickup/:orderId`
- keep focus in the scan box and scan barcodes
- view result banners and next-action guidance
- undo last scan
- reset current order
- mark partial with reason
- manually fulfill while the sale is open
- print order sheet
- complete or force-complete the order

Pickup feedback colors currently map to:
- green: accepted fulfillment
- amber: duplicate or already-fulfilled warning
- red: wrong order, unknown barcode, out-of-stock, or sale-closed block

### Run lookup and print

`/lookup-print` is the volunteer-safe paperwork station.

It supports:
- searching by customer name
- searching by order number
- searching by pickup code
- browsing by A-Z tabs
- recent active order lists
- printing order sheets
- printing seller packets when available

It intentionally does not expose:
- order creation
- order editing
- imports
- reports
- settings

### Create walk-up orders

`/walkup/new` supports same-day sales with stock protection.

Capabilities:
- search for an existing customer
- create a customer inline
- search plants by text or A-Z tabs
- inspect current walk-up availability snapshot
- prevent overcommitting stock by default
- request admin override when a line exceeds availability
- create the walk-up order and redirect to the order detail page

Walk-up safeguards:
- availability comes from the API, not just local UI state
- the UI adjusts visible availability for items already added to the in-progress order
- over-limit lines require admin approval before submission

### Print documents

Printable outputs currently include:
- customer order sheets
- seller packets
- batch order prints
- plant labels
- pickup cheat sheet
- lookup and print cheat sheet
- admin guide
- end-of-day checklist
- thermal label printer setup guide

## Kiosk Mode

Kiosk mode is browser-local. It affects only the current browser profile, not every device at the event.

It is configured from **Settings** under **This Device**.

Supported kiosk profiles:
- `pickup`
- `lookup-print`

What kiosk mode does:
- swaps the full app shell for the kiosk shell
- hides the normal navigation
- restricts the browser to approved station routes
- shows an `Admin Unlock` button in the header
- can request fullscreen on launch

Current kiosk landing routes:
- pickup kiosk: `/pickup`
- lookup and print kiosk: `/lookup-print`

## Sale Closed Behavior

The current app behavior treats sale-closed mode as a hard stop for pickup scanning.

When **Sale Closed** is enabled:
- barcode scanning is disabled
- pickup fulfillment is blocked
- manual fulfill is blocked
- new orders and modifications should not continue
- printing and read-only lookup/reporting remain available

To resume pickup work:
1. Open **Settings**.
2. Turn **Sale Closed** off.
3. Enter the admin PIN and reason when prompted.

## Admin-Protected Actions

Protected actions currently include:
- close sale
- reopen sale
- force-complete orders
- reset current order
- enable kiosk mode
- disable kiosk mode
- protected walk-up inventory overrides

Use specific reasons for auditability.

Good examples:
- `Customer accepted substitution approved by lead`
- `Wrong order scanned at station 2`
- `Late pickup window approved`

## Help and Print Surfaces

The in-app help center is available at:
- `http://localhost:3000/docs`

Current guide sections:
- kiosk mode
- pickup station
- lookup and print station
- sale closed
- admin override
- cheat sheets
- troubleshooting

Printable guide links exposed there:
- pickup station
- lookup and print
- admin actions
- end-of-day checklist
- thermal label setup

## Repository Structure

```text
.
|-- api/
|   |-- src/
|   |   |-- HamptonHawksPlantSales.Api/
|   |   |-- HamptonHawksPlantSales.Core/
|   |   `-- HamptonHawksPlantSales.Infrastructure/
|   `-- tests/
|       `-- HamptonHawksPlantSales.Tests/
|-- web/
|   |-- src/
|   |-- public/
|   `-- dist/                # generated on build
|-- docs/                    # specs, plans, and test artifacts
|-- test-results/            # local .NET test output
|-- docker-compose.yml
|-- docker-compose.portainer.yml
|-- run-tests.bat
`-- README.md
```

## Troubleshooting

### App redirects to login on every page load

Check:
- `Bootstrap__AdminUsername` and `Bootstrap__AdminPassword` are set and non-empty in the compose env
- The database is healthy (admin account must be persisted to be recognized on login)
- The session cookie domain matches the frontend origin

### Login fails with "Invalid credentials"

Check:
- The bootstrap admin was created — look for `Bootstrap admin account '...' created.` in API logs
- If no bootstrap variables are set, create an admin via the database directly
- Passwords are bcrypt-hashed; plaintext comparison will always fail

### API returns 401 even after login

Check:
- CORS `AllowedOrigins` includes the exact frontend origin (no trailing slash, correct protocol)
- `credentials: 'include'` is set on Axios requests
- The `SameSite` cookie attribute is compatible with your deployment (LAN vs localhost)

### Web loads but API calls fail

Check:
- API is running on port `8080`
- CORS includes the current frontend origin
- the database is healthy

### Print previews do not open

Likely cause:
- browser pop-up blocking

Fix:
- allow pop-ups for the site
- retry the print action

### Pickup station cannot scan

Check:
- the scan input has focus
- the sale is not closed
- the order is valid and not already complete
- the scanner is acting as a keyboard wedge and sending Enter

### Walk-up item shows unavailable

Possible reasons:
- preorder commitments consumed the remaining stock
- another operator changed availability
- the line needs an admin override

### Kiosk browser is stuck in station mode

Use:
- `Admin Unlock` in the kiosk header

If needed:
- verify the admin PIN
- return to Settings after unlock

## Maintainer Notes

If you change station behavior, also review these files so documentation stays aligned:
- `web/src/pages/DocsPage.tsx`
- `web/src/pages/print/PrintCheatsheetPickup.tsx`
- `web/src/pages/print/PrintCheatsheetLookup.tsx`
- `web/src/pages/print/PrintCheatsheetAdmin.tsx`
- `web/src/pages/print/PrintCheatsheetEndOfDay.tsx`
- `web/src/routes/kioskRouteConfig.ts`

This README is intended to describe the app as it exists now, not as originally planned. Update it alongside behavior changes so operators and developers can trust it.

