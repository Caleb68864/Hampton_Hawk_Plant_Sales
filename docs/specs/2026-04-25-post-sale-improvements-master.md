# Post-Sale Improvements -- Master Index Spec

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-25
- Author: Caleb Bennett
- Status: ready-to-execute via `/forge-dark-factory`
- Branch: `2026/04/25-1100-caleb-feat-post-sale-improvements`
- Type: **Master index spec** -- orchestrates four already-prepped bundles in a single Dark Factory v3 run.

This spec is a thin orchestrator. Every sub-spec entry below points at an existing detailed phase spec under `docs/specs/<bundle>/`. Workers MUST read the referenced phase-spec file as the canonical source for scope, files, implementation steps, interface contracts, verification commands, and Checks. This master only fixes the **execution order** and **dependency graph** so all 15 sub-specs can run in one autonomous build wave plan.

## Outcome
Five sequential waves merge in order to produce, on this branch:

- **Wave 1 (foundations):** Joy Pass shared UI vocabulary; Settings tunables backend; Orders bulk operations backend; Sales reports backend; Pick-list barcode columns + ScanSession entities.
- **Wave 2 (services + frontends that don't touch shared pages):** Walk-up schema; ScanSessionService; Quick Wins scan UX frontend; Quick Wins orders bulk frontend; Quick Wins reports frontend; Pick-list print pages.
- **Wave 3 (services + dependent frontends):** WalkUpRegisterService; Pick-list session frontend (after scan UX is in place to avoid PickupScanPage/PickupLookupPage merge collisions).
- **Wave 4:** Walk-up register page (depends on register service + Joy Pass).
- **Wave 5:** Walk-up legacy coexistence + station home updates.

When all waves complete: a single PR closes the loop on every spring-2026 sale-day pain point (debounce, auto-jump, multi-scan, post-complete focus, touchscreen layout, bulk order actions, per-student/per-buyer reports), the new walk-up cash-register flow ships behind a fallback link to the legacy form, the pick-list barcode workflow is functional end-to-end, and the whole product wears the Joy Pass typography + tactile button set.

## Intent
**Trade-off hierarchy:**
- **Convergent merge order over maximum parallelism.** Five waves with explicit serialization beat a "throw 15 workers at it" approach because three frontend specs touch `PickupScanPage.tsx` and `PickupLookupPage.tsx`.
- **Existing patterns over invention.** Every individual sub-spec is already validated against the existing service-layer + ApiResponse + RequiresAdminPin patterns from `CLAUDE.md`. This master adds nothing new -- only ordering.
- **Dark Factory v3 compliance over manual orchestration.** Every sub-spec has DF v3 frontmatter (`sub_spec_id`, `phase`, `depends_on`). Workers can resolve the wave graph from the depends_on field alone.

**Decision boundaries:**
- Decide autonomously: any decision the underlying phase spec already authorizes.
- Recommend + ask: anything the underlying phase spec marks "recommend + ask".
- Stop and ask: cross-spec coordination conflicts (e.g., two sub-specs touching the same lines simultaneously despite the wave plan), Lighthouse regression > 3 points, performance regressions on the production-target mini-PC.

## Context

This master index is the result of a single brainstorm session that produced four separate design docs, four master specs, fifteen phase specs, and four red-team reports -- all on this branch. The full inventory:

**Designs (in `docs/plans/`):**
- `2026-04-25-sale-quick-wins-bundle-design.md` (evaluated)
- `2026-04-25-walkup-cash-register-rewrite-design.md` (evaluated)
- `2026-04-25-picklist-barcode-workflow-design.md` (evaluated)
- `2026-04-25-frontend-polish-joy-pass.md` (evaluated)
- `2026-04-25-capacity-analysis-10-stations.md` (sidecar review, not a build target)
- `joy-pass-demo.html` (visual reference for the Joy Pass)

**Master specs (in `docs/specs/`):**
- `2026-04-25-sale-quick-wins-bundle.md` -- 6 sub-specs
- `2026-04-25-walkup-cash-register-rewrite.md` -- 4 sub-specs
- `2026-04-25-picklist-barcode-workflow.md` -- 4 sub-specs
- `2026-04-25-frontend-polish-joy-pass.md` -- 1 sub-spec

**Red-team reports (in `docs/specs/`, all advisories patched into the master specs):**
- `2026-04-25-sale-quick-wins-bundle-redteam-report.md`
- `2026-04-25-walkup-cash-register-rewrite-redteam-report.md`
- `2026-04-25-picklist-barcode-workflow-redteam-report.md`
- `2026-04-25-frontend-polish-joy-pass-redteam-report.md`

**Phase spec directories (in `docs/specs/<bundle>/`):**
- `sale-quick-wins-bundle/` -- index + 6 phase specs
- `walkup-cash-register-rewrite/` -- index + 4 phase specs
- `picklist-barcode-workflow/` -- index + 4 phase specs
- `frontend-polish-joy-pass/` -- index + 1 phase spec

## Requirements

1. Workers run sub-specs in dependency wave order. No sub-spec begins until its `depends_on` list is satisfied.
2. Each sub-spec body delegates to a real phase-spec file. Workers MUST read that file as canonical.
3. All EF migrations apply cleanly in order on a single Postgres database. No migration depends on a column added by a later migration.
4. The final merged branch passes `dotnet build`, `dotnet test`, and `npm run build` cleanly.
5. The final merged branch's manual smoke covers: scan a preorder, run a walk-up sale, scan a pick-list, view a report, and run a bulk order action -- all using the new components and on the touchscreen viewport.

## Wave Plan

```
Wave 1 (parallel, no deps)
├── SS-01  Joy Pass: components + typography
├── SS-02  Quick Wins: settings tunables backend
├── SS-03  Quick Wins: orders bulk backend
├── SS-04  Quick Wins: reports backend
└── SS-06  Pick-list: schema + entities + migrations

Wave 2 (parallel, depends on Wave 1)
├── SS-05  Walk-up: schema additions       (deps: SS-03, SS-04 -- shared OrderService/ReportService files)
├── SS-08  Pick-list: ScanSessionService    (deps: SS-06)
├── SS-09  Quick Wins: scan UX frontend     (deps: SS-01, SS-02)
├── SS-10  Quick Wins: orders bulk frontend (deps: SS-01, SS-03)
├── SS-11  Quick Wins: reports frontend     (deps: SS-01, SS-04)
└── SS-15  Pick-list: print barcodes        (deps: SS-06)

Wave 3 (parallel, depends on Wave 2)
├── SS-07  Walk-up: WalkUpRegisterService   (deps: SS-05)
└── SS-13  Pick-list: frontend session flow (deps: SS-01, SS-08, SS-09)

Wave 4 (depends on Wave 3)
└── SS-12  Walk-up: WalkUpRegisterPage      (deps: SS-01, SS-07)

Wave 5 (depends on Wave 4)
└── SS-14  Walk-up: legacy coexistence      (deps: SS-12)
```

**Why these dependencies (the non-obvious ones):**
- `SS-05 -> SS-03, SS-04`: SS-05 modifies `OrderService.GetAllAsync` and `ReportService` aggregations to exclude `Status=Draft`. Both files are also extended by SS-03 (bulk methods) and SS-04 (new aggregations). Sequencing avoids merge conflicts.
- `SS-13 -> SS-09`: SS-09 modifies `PickupLookupPage.tsx` and `PickupScanPage.tsx` for scan-UX changes. SS-13 also modifies the same files for `PLB-`/`PLS-` detection and `PickupScanSessionPage`. Sequencing ensures clean diffs.
- `SS-07 -> SS-05`: SS-07 (`WalkUpRegisterService`) consumes `OrderStatus.Draft`, nullable `Order.CustomerId`, and `OrderLine.LastScanIdempotencyKey` -- all introduced in SS-05.
- `SS-12 -> SS-07`: the page consumes the service's HTTP contract.
- `SS-14 -> SS-12`: legacy banner + station home CTA points at the new register page route.
- `SS-01` is referenced as a dep by every frontend sub-spec because the Joy Pass shared components (`TouchButton`, `SectionHeading`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `BotanicalEmptyState`, `BrandedStationGreeting`) are the visual vocabulary every page consumes.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. Joy Pass: components + typography

- **Bundle:** Frontend Polish -- Joy Pass
- **Phase spec (canonical):** `docs/specs/frontend-polish-joy-pass/sub-spec-1-joy-components.md`
- **Master spec:** `docs/specs/2026-04-25-frontend-polish-joy-pass.md`
- **Visual reference:** `docs/plans/joy-pass-demo.html`
- **Scope summary:** Six new shared components (`TouchButton`, `SectionHeading`, `BotanicalEmptyState`, `BrandedStationGreeting`, `ScanSuccessFlash`, `OrderCompleteCelebration`); self-host Fraunces and Manrope via `@fontsource/*`; add `web/src/styles/joy.css`; opt three pages in (`StationHomePage`, `PickupLookupPage`, `PickupScanPage`).
- **Acceptance criteria:** see canonical phase spec. The `## Checks` table there is authoritative.
- **Dependencies:** none.

---
sub_spec_id: SS-02
phase: run
depends_on: []
---

### 2. Quick Wins: settings tunables backend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-1-settings-tunables-backend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** Extend `AppSettings` with `PickupSearchDebounceMs`, `PickupAutoJumpMode`, `PickupMultiScanEnabled`. Add EF migration with safe defaults. Add `PUT /api/settings/scanner-tuning` endpoint with `[RequiresAdminPin]` + FluentValidation.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** none.

---
sub_spec_id: SS-03
phase: run
depends_on: []
---

### 3. Quick Wins: orders bulk backend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-3-orders-bulk-backend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** Add `BulkCompleteAsync` and `BulkSetStatusAsync` to `IOrderService`; add request DTOs + FluentValidation; add `POST /api/orders/bulk-complete` and `POST /api/orders/bulk-status` controller actions with `[RequiresAdminPin]`. Per-order row locks, transactional commit, per-order outcome list, Serilog logging, cap 500.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** none.

---
sub_spec_id: SS-04
phase: run
depends_on: []
---

### 4. Quick Wins: reports backend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-5-reports-backend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** Add `GetSalesBySellerAsync`, `GetSalesByCustomerAsync`, optional `GetSalesByPlantAsync` to `IReportsService`. Add `GET /api/reports/sales-by-seller`, `/sales-by-customer`, `/sales-by-plant`. Verify and add indexes on `Orders.SellerId` / `Orders.CustomerId` if missing.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** none.

---
sub_spec_id: SS-05
phase: run
depends_on: ['SS-03', 'SS-04']
---

### 5. Walk-up: schema additions

- **Bundle:** Walk-up Cash Register Rewrite
- **Phase spec (canonical):** `docs/specs/walkup-cash-register-rewrite/sub-spec-1-schema-additions.md`
- **Master spec:** `docs/specs/2026-04-25-walkup-cash-register-rewrite.md`
- **Scope summary:** Add `OrderStatus.Draft`. Make `Order.CustomerId` nullable. Add `Order.PaymentMethod` (string?), `Order.AmountTendered` (decimal?), `OrderLine.LastScanIdempotencyKey` (string?, indexed). Update `OrderService.GetAllAsync` and `ReportService` aggregates to exclude `Status=Draft` by default. Audit all `CustomerId` consumers for null-safety.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-03 (also modifies `OrderService.cs`), SS-04 (also modifies `ReportService.cs`).

---
sub_spec_id: SS-06
phase: run
depends_on: []
---

### 6. Pick-list: schema + entities + migrations

- **Bundle:** Pick-list Barcode Workflow
- **Phase spec (canonical):** `docs/specs/picklist-barcode-workflow/sub-spec-1-schema-and-entities.md`
- **Master spec:** `docs/specs/2026-04-25-picklist-barcode-workflow.md`
- **Scope summary:** Add `Customer.PicklistBarcode` and `Seller.PicklistBarcode` (unique). Add `ScanSession` and `ScanSessionMember` entities. Migration backfills existing rows with `PLB-`/`PLS-` 8-char codes; handles unique-violation retries.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** none.

---
sub_spec_id: SS-07
phase: run
depends_on: ['SS-05']
---

### 7. Walk-up: WalkUpRegisterService -- backend

- **Bundle:** Walk-up Cash Register Rewrite
- **Phase spec (canonical):** `docs/specs/walkup-cash-register-rewrite/sub-spec-2-walkup-register-service.md`
- **Master spec:** `docs/specs/2026-04-25-walkup-cash-register-rewrite.md`
- **Scope summary:** Implement `IWalkUpRegisterService` (CreateDraft, Scan, AdjustLine, VoidLine, Close, Cancel, GetOpenDrafts) and matching `WalkUpRegisterController`. Per-scan transactional row-lock + idempotency-key dedup. Reuse `IInventoryProtectionService.ValidateWalkupLineAsync`. Audit via `IAdminService.LogActionAsync`.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-05 (uses Draft enum, nullable CustomerId, idempotency key column).

---
sub_spec_id: SS-08
phase: run
depends_on: ['SS-06']
---

### 8. Pick-list: ScanSessionService -- backend

- **Bundle:** Pick-list Barcode Workflow
- **Phase spec (canonical):** `docs/specs/picklist-barcode-workflow/sub-spec-2-scan-session-service.md`
- **Master spec:** `docs/specs/2026-04-25-picklist-barcode-workflow.md`
- **Scope summary:** Implement `IScanSessionService` (CreateFromPicklist, Get, ScanInSession, Expand-stub, Close, ExpireStaleAsync) and matching controller. Hosted background service runs `ExpireStaleAsync` every 5 minutes with per-iteration error handling. Excludes `Status=Draft` from aggregation. Reuses fulfillment row-lock semantics.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-06 (uses PicklistBarcode columns + ScanSession entities).

---
sub_spec_id: SS-09
phase: run
depends_on: ['SS-01', 'SS-02']
---

### 9. Quick Wins: scan UX -- frontend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-2-scan-ux-frontend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** Wire `appStore` settings to the new tunables. Update `PickupLookupPage` auto-jump logic (drop format-heuristic gate when single exact match). Update `PickupScanPage` for multi-scan + post-complete redirect + touch-friendly above-the-fold action layout. Add Settings page "Scanner Tuning" section.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-01 (consumes `TouchButton`, `ScanSuccessFlash`, `OrderCompleteCelebration`, `SectionHeading`); SS-02 (consumes settings DTO/endpoint).

---
sub_spec_id: SS-10
phase: run
depends_on: ['SS-01', 'SS-03']
---

### 10. Quick Wins: orders bulk -- frontend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-4-orders-bulk-frontend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** Extend `OrdersListPage` with sortable columns (URL-param state), row selection, sticky `BulkActionToolbar`, `BulkResultModal`. Wire admin pin via existing `useAdminAuth`.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-01 (consumes `TouchButton`, `BotanicalEmptyState`, `SectionHeading`); SS-03 (consumes bulk endpoints).

---
sub_spec_id: SS-11
phase: run
depends_on: ['SS-01', 'SS-04']
---

### 11. Quick Wins: reports -- frontend

- **Bundle:** Sale Quick Wins
- **Phase spec (canonical):** `docs/specs/sale-quick-wins-bundle/sub-spec-6-reports-frontend.md`
- **Master spec:** `docs/specs/2026-04-25-sale-quick-wins-bundle.md`
- **Scope summary:** New report pages (`SalesBySellerPage`, `SalesByCustomerPage`, optional `SalesByPlantPage`) with sortable tables and CSV export. Link them from `ReportsPage`. New `csvExport` utility (UTF-8 with BOM).
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-01 (consumes `SectionHeading`, `BotanicalEmptyState`, `TouchButton`); SS-04 (consumes report endpoints + DTOs).

---
sub_spec_id: SS-12
phase: run
depends_on: ['SS-01', 'SS-07']
---

### 12. Walk-up: WalkUpRegisterPage -- frontend

- **Bundle:** Walk-up Cash Register Rewrite
- **Phase spec (canonical):** `docs/specs/walkup-cash-register-rewrite/sub-spec-3-walkup-register-page.md`
- **Master spec:** `docs/specs/2026-04-25-walkup-cash-register-rewrite.md`
- **Scope summary:** New `WalkUpRegisterPage` cash-register UX. Persists `draftId` in `appStore` per workstation. Each scan generates `crypto.randomUUID()` idempotency key. Resumes on reload. Close Sale captures `paymentMethod` + `amountTendered`. Cancel/Void are admin-pin gated.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-01 (consumes `TouchButton`, `ScanSuccessFlash`); SS-07 (consumes register service HTTP contract).

---
sub_spec_id: SS-13
phase: run
depends_on: ['SS-01', 'SS-08', 'SS-09']
---

### 13. Pick-list: frontend session flow

- **Bundle:** Pick-list Barcode Workflow
- **Phase spec (canonical):** `docs/specs/picklist-barcode-workflow/sub-spec-3-frontend-session-flow.md`
- **Master spec:** `docs/specs/2026-04-25-picklist-barcode-workflow.md`
- **Scope summary:** Detect `PLB-`/`PLS-` at lookup; create session; navigate to new `PickupScanSessionPage`. Parameterize existing `useScanWorkflow` for `mode: 'order' | 'session'`. Add explicit per-order regression test post-parameterization.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-01 (visual vocabulary); SS-08 (consumes session endpoints); **SS-09 (also modifies `PickupLookupPage.tsx` and `PickupScanPage.tsx`; sequencing avoids merge conflict)**.

---
sub_spec_id: SS-14
phase: run
depends_on: ['SS-12']
---

### 14. Walk-up: legacy coexistence + station home updates

- **Bundle:** Walk-up Cash Register Rewrite
- **Phase spec (canonical):** `docs/specs/walkup-cash-register-rewrite/sub-spec-4-legacy-coexistence.md`
- **Master spec:** `docs/specs/2026-04-25-walkup-cash-register-rewrite.md`
- **Scope summary:** Banner on legacy `WalkUpNewOrderPage`. Update `StationHomePage` to make Register the primary CTA, legacy form a secondary fallback. Write `docs/cheatsheets/walkup-register.md`.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-12 (links to register route).

---
sub_spec_id: SS-15
phase: run
depends_on: ['SS-06']
---

### 15. Pick-list: print pages render barcode

- **Bundle:** Pick-list Barcode Workflow
- **Phase spec (canonical):** `docs/specs/picklist-barcode-workflow/sub-spec-4-print-barcodes.md`
- **Master spec:** `docs/specs/2026-04-25-picklist-barcode-workflow.md`
- **Scope summary:** Update existing summary print pages (`PrintCheatsheetPickup`, `PrintSellerPacketPage`) to render the entity's `PicklistBarcode` as a Code128 barcode in the header.
- **Acceptance criteria:** see canonical phase spec.
- **Dependencies:** SS-06 (consumes `PicklistBarcode` columns).

## Edge Cases

- **Worker reads only this master spec.** A worker that doesn't read the linked phase spec will fail acceptance because every sub-spec body delegates. Workers MUST follow the link.
- **Migration ordering.** Three sub-specs add EF migrations: SS-02 (scanner tunings), SS-05 (Walk-up schema), SS-06 (pick-list). EF Core writes migrations with timestamp prefixes; running `dotnet ef database update` after merge applies them in chronological order. As long as `dotnet ef migrations add` is called in dependency-wave order, the timestamp ordering is correct. If two workers in the same wave both run `add` in parallel against the same checkout, prefer running migrations sequentially within the wave.
- **`OrderService.cs` shared modifications.** SS-03, SS-05 both modify it. SS-05 depends on SS-03 to enforce a clean sequential merge.
- **`ReportService.cs` shared modifications.** SS-04, SS-05 both modify it. SS-05 depends on SS-04 likewise.
- **`PickupLookupPage.tsx` and `PickupScanPage.tsx` shared modifications.** SS-01 (opt-in), SS-09 (scan UX), SS-13 (session flow). Wave 1 -> Wave 2 -> Wave 3 sequencing handles this.
- **`StationHomePage.tsx` shared modifications.** SS-01 (opt-in via `BrandedStationGreeting`), SS-14 (register CTA). Wave 1 -> Wave 5 sequencing handles this.
- **`@fontsource/*` install.** Single `npm install` in SS-01 adds the deps. Subsequent frontend sub-specs reuse the install; no duplicate installs.
- **Test isolation.** Each sub-spec's tests use a per-test database scope (existing fixture). Concurrent migration applies in CI must use a unique database per worker; for the dev container, sequence migrations in the merge order above.
- **Cumulative Lighthouse impact.** The Joy Pass introduces font + animation cost. Quick Wins reports introduce two new pages. Pick-list adds one new page. SS-01's "no more than 3 points regression" is the budget for the foundational hit; subsequent sub-specs MUST NOT re-baseline downward.
- **Admin pin propagation.** Existing `APP_ADMIN_PIN=1234` env var (per `docker-compose.yml`) covers SS-02, SS-03, SS-05, SS-07. No changes to the admin pin distribution model.
- **Backfill of `PicklistBarcode`.** SS-06's migration backfills via SQL with `md5(random())`; uniqueness handled by retry pattern documented in the phase spec.

## Out of Scope

- Anything not already in one of the four bundles' Out-of-Scope sections.
- Capacity hardening (covered separately by `docs/plans/2026-04-25-capacity-analysis-10-stations.md`; deploy as a follow-up small spec if desired).
- Removal of the legacy `WalkUpNewOrderPage` (deferred one cycle per Walk-up master spec).
- Receipt printer driver integration.
- Card payment processing.

## Constraints

### Musts
- Workers MUST read the linked phase spec for each sub-spec; this master is an index only.
- Wave order MUST be respected; no sub-spec begins until its `depends_on` list is satisfied.
- All EF migrations MUST apply cleanly via `dotnet ef database update` after merge.
- All sub-specs MUST satisfy their phase-spec `## Checks` table commands.
- Final merged branch MUST pass `cd api && dotnet build && dotnet test` and `cd web && npm run build`.
- All admin operations MUST remain `[RequiresAdminPin]`.

### Must-Nots
- MUST NOT introduce new external NuGet packages beyond what individual sub-specs explicitly authorize.
- MUST NOT introduce npm packages beyond `@fontsource/fraunces` and `@fontsource/manrope` (allowed by SS-01).
- MUST NOT alter existing `OrderStatus` values' semantics (only `Draft` is added).
- MUST NOT break the existing per-order pickup scan flow (`/pickup/{orderId}`).
- MUST NOT remove the legacy `WalkUpNewOrderPage` in this run.
- MUST NOT modify the `--color-hawk-*` or `--color-gold-*` palette.

### Preferences
- Prefer running each wave's sub-specs in parallel where possible.
- Prefer sequential merge of waves to avoid surprise conflicts.
- Prefer reusing the existing `IFulfillmentService` row-lock pattern over inventing new transactional shapes.
- Prefer `crypto.randomUUID()` for client-side identifiers.
- Prefer self-hosted fonts over CDN.

### Escalation Triggers
- A worker hits a merge conflict despite the wave plan -- stop, escalate, do not auto-resolve destructively.
- A migration fails to apply on the dev container.
- Lighthouse Performance regression > 3 points cumulatively across all sub-specs.
- Any sub-spec's `## Checks` table fails after implementation -- stop, present output, do not mark sub-spec complete.

## Verification

Per-sub-spec verification lives in each linked phase spec's `## Checks` table. The master-level verification, after all 15 sub-specs land:

1. **Backend build + test:**
   ```sh
   cd api
   dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet
   dotnet test HamptonHawksPlantSales.sln --no-build -v quiet
   ```
2. **Frontend build:**
   ```sh
   cd web
   npm install
   npm run build
   ```
3. **Migrations apply cleanly:**
   ```sh
   cd api
   dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
   ```
4. **No CDN font URL in built bundle:**
   ```sh
   ! grep -rq "fonts.googleapis.com" web/dist 2>/dev/null
   ```
5. **End-to-end smoke** with `start.bat` running:
   - `/station` shows Joy Pass branded greeting + stats + quick actions.
   - `/pickup` -- scan an order sheet barcode, scan a plant -> ScanSuccessFlash bloom; press Complete Order -> OrderCompleteCelebration -> redirect to `/pickup` with focus.
   - `/pickup` -- scan a `PLS-XXXXXXXX` printed pick list -> `/pickup/session/{id}` loads with all of that student's plants; scanning routes correctly across orders.
   - `/walkup/register/new` -- new sale; scan 3 plants; close with cash $20; receipt renders; inventory decreased.
   - `/orders` -- sortable columns; select 5 orders; Mass Complete with admin pin; result modal shows per-order outcome.
   - `/reports/sales-by-seller` -- table renders sortable; CSV export works.
   - DevTools `prefers-reduced-motion: reduce` -- bloom/confetti/stamp animations disabled; static states render.
6. **Regression check on existing per-order pickup flow:** scan an order at `/pickup/{orderId}` (NOT a session) -- per-line scanning + Complete Order works identically to pre-merge behavior.

## Deployment Notes

This branch is `2026/04/25-1100-caleb-feat-post-sale-improvements`. After Dark Factory completes all 15 sub-specs:

### 1. Pre-deploy: review and merge
- Open a PR from this branch to `main`.
- Verify all checks pass; review red-team reports under `docs/specs/*-redteam-report.md`.
- Squash-or-merge per repo convention (no documented preference today; default to a merge commit so the wave-by-wave history is auditable).

### 2. Migrations
Three new EF migrations land on `main`:
- `{ts}_AddScannerTunings.cs` (from SS-02)
- `{ts}_WalkUpRegisterSchema.cs` (from SS-05)
- `{ts}_AddPicklistBarcodesAndScanSessions.cs` (from SS-06)

To apply on the production mini-PC:
```sh
cd api
dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```
Or, if running against the docker-compose stack:
```sh
docker compose exec api dotnet ef database update --project src/HamptonHawksPlantSales.Infrastructure --startup-project src/HamptonHawksPlantSales.Api
```
Order does not matter beyond what the EF migrator already enforces by timestamp.

### 3. Container rebuild
The repo includes `update.bat` (added in commit b3a3d51) which performs the rebuild + restart. After merge, on the production host:
```bat
update.bat
```
This rebuilds api + web images and restarts the docker-compose stack.

### 4. Settings sanity check
After deploy, an admin should:
- Open `/settings` and confirm "Scanner Tuning" section shows defaults: debounce 120, mode `BestMatchWhenSingle`, multi-scan ON.
- (Optional) tweak the debounce to a value that suits the chosen scanner hardware.

### 5. Backfill verification
After migrations apply, confirm pick-list barcodes seeded:
```sql
SELECT COUNT(*) FROM "Customers" WHERE "PicklistBarcode" IS NULL OR "PicklistBarcode" = '';
SELECT COUNT(*) FROM "Sellers"   WHERE "PicklistBarcode" IS NULL OR "PicklistBarcode" = '';
```
Both should return 0.

### 6. Reprint pick-lists
SS-15 adds the new barcode to existing summary print pages. Reprint any pick-list sheets that volunteers will use during the next sale; old printouts do not include the barcode.

### 7. Capacity tuning (recommended, separate spec)
The capacity analysis at `docs/plans/2026-04-25-capacity-analysis-10-stations.md` recommends a small Postgres tuning patch + connection-pool sizing for 10 stations. Consider running that as a follow-up "Pre-Sale Capacity Hardening" spec before next year's sale.

### 8. Rollback plan
Each wave is its own logical layer. If a regression surfaces in production:
- **Frontend regression:** redeploy the previous `web` image; the API and DB stay current.
- **API regression:** redeploy the previous `api` image; if a migration is implicated, run `dotnet ef migrations remove` against the offending migration **only after** restoring its inverse on the DB (rare; migrations here are additive).
- **DB regression:** restore from the daily `pg_dump` backup the capacity analysis recommends maintaining during sale week.
- **Whole-bundle rollback:** `git revert` the merge commit; redeploy via `update.bat`.

### 9. Communication
- Update the cashier cheatsheets after merge:
  - `docs/cheatsheets/walkup-register.md` (new, from SS-14)
  - Existing `docs/cheatsheets/end-of-day.md` may want a note about the new bulk Complete Order recovery path.
- A short "what's new" handout for sale-day volunteers covering: scan-success animation (no action needed; just confirmation), pick-list barcode workflow (one scan loads everything), walk-up register (replaces the old form for new sales).

## Approaches Considered
- **A: Single mega-spec rewriting all 15 sub-specs inline.** Rejected -- duplicates content already in canonical phase specs; high drift risk if a phase spec is later edited and the mega-spec isn't.
- **B (Selected): Index spec delegating to canonical phase specs.** This file. Workers read the index for ordering and the phase spec for execution. Single source of truth per sub-spec.
- **C: Skip the master entirely; let Dark Factory orchestrate from the four separate master specs.** Rejected -- DF v3 expects a single master spec entry; coordinating cross-bundle dependencies (especially the `PickupScanPage.tsx` SS-01 -> SS-09 -> SS-13 chain) without one orchestrating doc would force ad-hoc dependency wiring.

## Next Steps
- [ ] **You:** verify the wave plan and dependencies match your intent.
- [ ] Run `/forge-dark-factory docs/specs/2026-04-25-post-sale-improvements-master.md` to execute all 15 sub-specs in five waves on this branch.
- [ ] Review the resulting PR; merge if green.
- [ ] Run migrations + `update.bat` on the production mini-PC.
- [ ] Schedule a follow-up small spec for "Pre-Sale Capacity Hardening" (Postgres tuning + connection pool sizing).
