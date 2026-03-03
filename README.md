# Hampton Hawks Plant Sales

A full-stack web application for managing a school plant sale fundraiser. Handles the complete lifecycle: importing catalog/order data, managing inventory, processing walk-up sales, barcode scanning at pickup stations, and generating reports.

## Quick Start

The fastest way to run everything is with Docker Compose:

```bash
docker-compose up --build
```

This starts three services:

| Service    | URL                        |
|------------|----------------------------|
| Web UI     | http://localhost:3000       |
| API        | http://localhost:8080       |
| Swagger UI | http://localhost:8080/swagger |
| PostgreSQL | localhost:5432              |

The database is automatically created and migrations run on startup.

## Environment Variables

### API (`api` service)

| Variable                              | Description                         | Default         |
|---------------------------------------|-------------------------------------|-----------------|
| `ConnectionStrings__Default`          | PostgreSQL connection string        | (required)      |
| `APP_ADMIN_PIN`                       | 4-digit admin PIN for overrides     | `1234`          |
| `INVENTORY_NEGATIVE_ADJUST_THRESHOLD` | Max negative inventory adjustment   | `10`            |
| `ASPNETCORE_ENVIRONMENT`              | ASP.NET environment                 | `Production`    |
| `ASPNETCORE_URLS`                     | API listen URL                      | `http://+:8080` |

### Web (`web` service)

The Vite dev server proxies `/api` requests to `http://localhost:8080`. In production the web container is a static nginx build.

## Usage

### Importing Data

1. Navigate to **Imports** in the sidebar
2. Upload CSV or Excel files for plants, inventory, or orders
3. Use dry-run first (`?dryRun=true`) to validate rows before committing
4. For plant re-imports, use SKU upsert (`?upsertBySku=true`, default) to update existing items without duplicates
5. Review any import issues on the batch detail page

### Managing Orders

- **Pre-orders**: Created via import or manually through the Orders page
- **Walk-up orders**: Created at the Walk-Up page for day-of customers
- Walk-up orders are subject to inventory protection (available = on-hand minus pre-order commitments)

### Pickup / Scanning

1. Go to the **Pickup** page
2. Search by customer name, pickup code, or order number
3. Scan each plant barcode -- the system matches it to order lines
4. When all lines are fulfilled, click **Complete**

### Printing

- **Order sheets**: Print an order summary for the customer (`/print/order/:orderId`)
- **Seller packets**: Print a seller's complete order list (`/print/seller/:sellerId`)
- **Cheat sheets**: Printable quick-reference guides for stations
  - Pickup Station: `/print/cheatsheet/pickup`
  - Lookup & Print: `/print/cheatsheet/lookup`
  - Admin: `/print/cheatsheet/admin`
  - End of Day: `/print/cheatsheet/end-of-day`

### Sale Closed (Admin)

When the fundraiser ends, an admin can close the sale from **Settings**. This blocks new orders and modifications but still allows fulfillment scanning. The admin PIN is required. Closing/reopening is logged with a reason.

Actions that always require the admin PIN:
- Toggling SaleClosed
- Force-completing an order with unfulfilled lines
- Resetting an order back to Open
- Exceeding available walk-up inventory

## Development

### Prerequisites

- .NET 9 SDK
- Node.js 20+
- PostgreSQL 16 (or use Docker)

### Running Locally

```bash
# Start the database
docker-compose up postgres -d

# API
cd api/src/HamptonHawksPlantSales.Api
dotnet run

# Web (separate terminal)
cd web
npm install
npm run dev
```

### Swagger

API documentation is available at `/swagger` when running in Development mode. All endpoints have XML doc summaries.

### Storybook

```bash
cd web
npm run storybook
```

Opens at http://localhost:6006 with stories for core components: ScanInput, StatusChip, OrderLinesTable, QuickFindOverlay, AzTabs, PrintLayout.

### TypeDoc

```bash
cd web
npm run docs
```

Generates TypeScript API documentation in `web/docs-output/`.

## Tech Stack

| Layer      | Technology                                |
|------------|-------------------------------------------|
| Frontend   | React 19, TypeScript, Tailwind CSS v4, Vite 7 |
| State      | Zustand                                   |
| Routing    | React Router v7                           |
| Backend    | ASP.NET Core 9 (C#), Entity Framework Core |
| Validation | FluentValidation                          |
| Database   | PostgreSQL 16                             |
| Logging    | Serilog                                   |
| Docs       | Swagger/OpenAPI, Storybook, TypeDoc       |
| Container  | Docker, Docker Compose                    |
