---
type: phase-spec
sub_spec: 12
title: "Documentation (Swagger, Storybook, TypeDoc, In-App Docs, README)"
master_spec: "docs/specs/2026-03-02-hampton-hawks-plant-sales.md"
dependencies: [9, 10]
---

# Sub-Spec 12: Documentation

## Shared Context

See [master spec](../2026-03-02-hampton-hawks-plant-sales.md). Reference `spec.md` Section 12 for documentation requirements.

---

## Implementation Steps

### Step 1: Configure Swagger XML Docs

**Modify `/api/src/HamptonHawksPlantSales.Api/HamptonHawksPlantSales.Api.csproj`:**
```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

**Modify Program.cs Swagger config:**
- Include XML comments file in Swagger options
- Add XML doc comments (summary tags) to all controllers and action methods
- Document DTOs with summary/remarks tags
- Document enums

**Verify:** `cd api && dotnet build` (no warnings from missing docs)

---

### Step 2: Add XML Doc Comments to All Controllers

**Modify each controller file:**
- Add `/// <summary>` to each endpoint method
- Add `/// <param>` for parameters
- Add `/// <response>` for response codes
- Add `/// <summary>` to DTO classes and properties

**Target controllers:** Plants, Inventory, Sellers, Customers, Orders, Fulfillment, WalkUp, Import, Settings, Reports

**Verify:** `cd api && dotnet build && docker-compose up -d --build` → check `/swagger` shows descriptions

---

### Step 3: Set Up Storybook

**Run in `/web/`:**
```bash
npx storybook@latest init --type react_vite
```

**Configure `/web/.storybook/main.ts`:**
- Stories glob: `../src/**/*.stories.@(ts|tsx)`
- Add Tailwind CSS support

**Verify:** `cd web && npm run storybook` starts without errors

---

### Step 4: Write Stories for Core Components

**Create stories for 6 required components:**

- `/web/src/components/pickup/ScanInput.stories.tsx` -- default state, with value, disabled
- `/web/src/components/shared/StatusChip.stories.tsx` -- all statuses (Open, InProgress, Complete, Cancelled, Problem)
- `/web/src/components/OrderLinesTable.stories.tsx` -- empty, with lines, with fulfilled lines, read-only
- `/web/src/components/shared/QuickFindOverlay.stories.tsx` -- open state, with results, empty results
- `/web/src/components/shared/AzTabs.stories.tsx` -- default, with active tab, with counts
- `/web/src/components/print/PrintLayout.stories.tsx` -- with sample content

**Verify:** `cd web && npm run storybook` → all 6 stories render

---

### Step 5: Set Up TypeDoc

**Install:** `cd web && npm install -D typedoc`

**Create `/web/typedoc.json`:**
```json
{
  "entryPoints": ["src"],
  "entryPointStrategy": "expand",
  "out": "docs",
  "exclude": ["**/*.stories.tsx", "**/*.test.tsx"],
  "tsconfig": "tsconfig.json"
}
```

**Add script to `/web/package.json`:** `"docs": "typedoc"`

**Verify:** `cd web && npm run docs` generates output in `web/docs/`

---

### Step 6: Create In-App Docs Page

**Replace placeholder:**
- `/web/src/pages/DocsPage.tsx`

**Content sections:**
1. **Scan Workflow** -- how scanning works, what each result means
2. **Sale Closed** -- what gets locked, what admins can still do
3. **Admin Override** -- when PIN is needed, how to use it
4. **Walk-Up Protection** -- how available inventory is calculated, when override is needed
5. **Keyboard Shortcuts** -- Ctrl+K, A-Z tabs, /, Esc
6. **Cheat Sheets** -- links to all 4 print cheat sheet pages
7. **Common Issues** -- "Barcode not found" → check import, "Wrong order" → add item to order, "Out of stock" → check inventory

**Verify:** `cd web && npm run build`

---

### Step 7: Write README.md

**Create `/README.md`:**

**Sections:**
1. **What is this?** -- School plant fundraiser management system
2. **Quick Start** -- `docker-compose up -d`, access web at `http://localhost:3000`, API at `http://localhost:8080`
3. **Environment Variables** -- APP_ADMIN_PIN, ConnectionStrings__Default, INVENTORY_NEGATIVE_ADJUST_THRESHOLD
4. **Usage** -- Import plants → Import inventory → Import orders → Start pickup
5. **Printing** -- Order sheets at /print/order/:id, seller packets at /print/seller/:id, cheat sheets at /print/cheatsheet/*
6. **Admin** -- Toggle SaleClosed at /settings, force complete, reset orders
7. **Development** -- Swagger at /swagger, Storybook: `cd web && npm run storybook`, TypeDoc: `cd web && npm run docs`
8. **Tech Stack** -- .NET 10, React, PostgreSQL 16, Docker

**Verify:** README exists and is well-formatted.

---

### Step 8: Create Markdown Cheat Sheets

**Create `/docs/cheatsheets/`:**
- `pickup-station.md`
- `lookup-and-print.md`
- `admin.md`
- `end-of-day.md`

Content mirrors the print cheat sheet pages (spec Section 14.2). These serve as version-controlled reference docs.

**Verify:** Files exist and content is complete.

---

## Interface Contracts

### Provides:
- Swagger UI with XML docs for all endpoints
- Storybook with 6 component stories
- TypeDoc generation
- In-app docs page
- README.md
- Markdown cheat sheets in docs/

### Requires (from Sub-Spec 9):
- ScanInput component exists for Storybook story

### Requires (from Sub-Spec 10):
- PrintLayout component exists for Storybook story

---

## Verification Commands

**Swagger:** `docker-compose up -d --build` → browse `/swagger` → verify all endpoints have descriptions
**Storybook:** `cd web && npm run storybook` → verify 6 stories render
**TypeDoc:** `cd web && npm run docs` → verify output in web/docs/
**Docs page:** Browse `/docs` in app → verify all sections present
**README:** Verify README.md has all required sections
