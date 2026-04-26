---
sub_spec_id: SS-01
phase: run
depends_on: []
master_spec: "self"
---

# Joy Pass — Back-Office Sweep

## Meta
- Client: Hampton Hawks
- Project: Hampton Hawks Plant Sales
- Repo: Hampton_Hawks_Plant_Sales
- Date: 2026-04-26
- Author: Caleb Bennett (drafted with Claude)
- Source: post-sale-improvements run + user request to extend joy-pass coverage
- Reference preview: `docs/plans/joy-pass-demo.html`
- Companion spec: `docs/specs/2026-04-25-frontend-polish-joy-pass.md` (SS-01 was opt-in by design; this spec is the opt-in for the rest)

## Outcome
Every navigable admin/back-office page in the web app shares one visual language: paper-grain background, display-font headings with eyebrow labels, gilded shadow on cards, `TouchButton` for primary actions, `BotanicalEmptyState` for empty data states. A new `<JoyPageShell>` wrapper component is the single mechanism that delivers the chrome — pages opt in by wrapping their content. Print pages and tiny utility pages stay unstyled by design. Volunteers and admins see the same warm Hampton Hawks vocabulary whether they are at the kiosk, in Settings, or in the Customers list.

## Intent
**Trade-off hierarchy:**
- **One wrapper component over per-page hand-rolled chrome.** A `<JoyPageShell>` enforces consistency and makes future restyles a one-file change.
- **Progressive enhancement over rewrites.** Wrap, swap headings, swap empty states, swap primary buttons. Leave data tables, charts, and form internals neutral — joy lifts the chrome, not the dense data.
- **Print fidelity over visual unity.** Print pages explicitly opt OUT — they must render cleanly on thermal printers and to PDF.
- **Auditable, additive change.** No behavior changes. No palette changes. No new dependencies. Removing the polish is a one-line revert per page (un-wrap from `<JoyPageShell>`).

**Decision boundaries:**
- Decide autonomously: prop names on `JoyPageShell`, exact padding/max-width, how to migrate existing `<EmptyState>` usages.
- Recommend + ask: any place where wrapping in `JoyPageShell` would visibly break an existing layout (kiosk-mode constraints, full-bleed pages).
- Stop and ask: any need to add a CSS framework, animation library, or a new color token; any time joy treatment would hurt usability or accessibility.

## Context
After the post-sale-improvements run shipped (April 2026), joy-pass coverage extended to the kiosk pages (StationHome, PickupLookup, PickupScan, PickupScanSession), the new walk-up register, the new sales reports, and OrdersListPage / SettingsPage / ReportsPage. Roughly 25 admin/back-office pages were never targeted by any sub-spec (Dashboard, Customers, Plants, Sellers, Inventory, Imports, NewOrder, OrderDetail, WalkUp new order, LeftoverInventory, etc.). They render with the original utilitarian Tailwind chrome. Admins and volunteers experience a jarring shift each time they navigate from a kiosk page into the back office.

Print pages (`pages/print/*`, `LookupPrintStationPage`) are excluded because joy gradients, shadows, and paper-grain backgrounds print poorly on thermal printers and waste toner on laser PDFs. `NotFoundPage`, `Placeholder`, and `DocsPage` are excluded as low-traffic utility pages where the cost-to-restyle exceeds the user value.

## Requirements

1. New shared component `web/src/components/shared/JoyPageShell.tsx` exists. It accepts `title` (string), `eyebrow` (optional string), `actions` (optional ReactNode rendered to the right of the heading), `children`, and an optional `maxWidth` ('default' | 'wide' | 'full', default 'default'). It renders a paper-grain background, top spacing, container with sane max-width, and a `SectionHeading` (level 1) using the `title` and `eyebrow`. Children render below.
2. Every page in the **In-Scope Pages** list below is wrapped in `<JoyPageShell>` and uses joy vocabulary for its chrome (heading via shell, primary action via `TouchButton`, empty state via `BotanicalEmptyState` where applicable).
3. The **Out-of-Scope Pages** list is left alone — no `<JoyPageShell>` wrapping, no joy components, no new imports.
4. Existing functional behavior is preserved on every wrapped page: routing, data fetching, forms, validation, sorting, pagination, admin-pin gating, kiosk-mode behavior, store interactions, all unchanged.
5. Existing data tables stay in neutral gray styling (table headers, rows, sort buttons). Joy treatment lifts the chrome, not the table interior.
6. Existing `<EmptyState>` usages on in-scope pages are migrated to `<BotanicalEmptyState>` where the page has a real "no data" or "no results" affordance. Where `<EmptyState>` is used as an inline error or info chip (not a true empty state), it stays as-is.
7. Charts, status pills, progress rings, and any color used for data encoding (red for danger, green for success, blue for info) are NOT recolored to hawk/gold. Data colors stay legible.
8. `web/src/styles/joy.css` is unchanged. `web/src/index.css` is unchanged. `main.tsx` is unchanged. No new CSS files. No new dependencies.
9. `cd web && npm run build` succeeds. Existing tests pass (`cd web && npm test --run` if present). No new TypeScript errors. No new eslint regressions.
10. `prefers-reduced-motion: reduce` is honored — no new animations are introduced; existing TouchButton press-down stays as-is.

## In-Scope Pages (must be wrapped + joy-vocab applied)

Listed in suggested implementation order (cheapest first, lets the implementer build muscle memory before tackling the dense ones):

1. `web/src/pages/DashboardPage.tsx`
2. `web/src/pages/customers/CustomersListPage.tsx`
3. `web/src/pages/customers/CustomerDetailPage.tsx`
4. `web/src/pages/plants/PlantsListPage.tsx`
5. `web/src/pages/plants/PlantDetailPage.tsx`
6. `web/src/pages/sellers/SellersListPage.tsx`
7. `web/src/pages/sellers/SellerDetailPage.tsx`
8. `web/src/pages/inventory/InventoryPage.tsx`
9. `web/src/pages/imports/ImportsPage.tsx`
10. `web/src/pages/orders/NewOrderPage.tsx`
11. `web/src/pages/orders/OrderDetailPage.tsx`
12. `web/src/pages/walkup/WalkUpNewOrderPage.tsx` *(legacy walk-up; SS-14 added a deprecation banner — keep the banner intact, restyle the page chrome only)*
13. `web/src/pages/reports/LeftoverInventoryPage.tsx`

For each: wrap in `<JoyPageShell title="..." eyebrow="..." actions={<primary CTA TouchButton(s)>}>`. Replace bare `<button>` primary actions with `<TouchButton>`. Replace `<EmptyState>` → `<BotanicalEmptyState>` where applicable. Sub-section headings inside the page may use `<SectionHeading level={3}>` for visual hierarchy.

## Out-of-Scope Pages (must NOT be touched)

- `web/src/pages/NotFoundPage.tsx` — utility page, low traffic
- `web/src/pages/Placeholder.tsx` — placeholder, intentionally bare
- `web/src/pages/DocsPage.tsx` — content-driven; existing styling is fine
- `web/src/pages/lookupprint/LookupPrintStationPage.tsx` — print-targeted
- `web/src/pages/print/*.tsx` (all 11 print pages) — must render cleanly on thermal/laser printers; joy chrome would damage print output
- All pages already covered by prior sub-specs (StationHome, PickupLookup, PickupScan, PickupScanSession, WalkUpRegister, OrdersListPage, SettingsPage, ReportsPage, SalesBy*Page) — already done, do not double-restyle

## Wave Plan

Single wave of work, since all 13 pages are independent (no cross-page state coupling). The implementer can do them sequentially or batch-edit.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. JoyPageShell component + back-office sweep

- **Scope:** Add `JoyPageShell` shared component; wrap and restyle the 13 in-scope pages.
- **Files (create):**
  - `web/src/components/shared/JoyPageShell.tsx`
- **Files (modify):**
  - All 13 pages in the In-Scope list above.
- **Acceptance criteria:**
  - `JoyPageShell.tsx` exists, exports a `JoyPageShell` React component with the props described in Requirement 1.
  - Each of the 13 in-scope pages imports and wraps its content in `<JoyPageShell>`.
  - Each in-scope page uses `<TouchButton>` for at least one primary action (where the page has a primary action — Dashboard may not).
  - Each in-scope page that previously rendered `<EmptyState>` for a true empty data state now renders `<BotanicalEmptyState>` instead.
  - `cd web && npm run build` succeeds, exit 0.
  - `git diff --stat HEAD~1 HEAD` shows changes ONLY in `web/src/components/shared/JoyPageShell.tsx` (new) and the 13 in-scope page files. No other files modified. No deletions.
  - No file in the Out-of-Scope list is modified.
  - No new packages in `web/package.json`.
  - No edits to `web/src/styles/joy.css`, `web/src/index.css`, or `web/src/main.tsx`.
- **Verification commands** (the verifier will run these from project root):
  - `test -f web/src/components/shared/JoyPageShell.tsx`
  - `grep -q "export.*JoyPageShell" web/src/components/shared/JoyPageShell.tsx`
  - For each in-scope page: `grep -q "JoyPageShell" <page>` should exit 0
  - `cd web && npm run build`
  - `git diff --name-only HEAD~1 HEAD | grep -vE "^(web/src/components/shared/JoyPageShell\.tsx|web/src/pages/(DashboardPage|customers/CustomersListPage|customers/CustomerDetailPage|plants/PlantsListPage|plants/PlantDetailPage|sellers/SellersListPage|sellers/SellerDetailPage|inventory/InventoryPage|imports/ImportsPage|orders/NewOrderPage|orders/OrderDetailPage|walkup/WalkUpNewOrderPage|reports/LeftoverInventoryPage)\.tsx)$"` — must produce NO output

---

## Edge Cases

- **Kiosk mode pages:** None of the 13 in-scope pages should render in pure kiosk mode (kiosk routes are limited to pickup + station + walk-up register). If wrapping causes layout issues with the kiosk header, escalate.
- **Pages with full-bleed backgrounds (e.g., Dashboard hero):** `JoyPageShell` should accept `maxWidth="wide"` or `"full"` to opt out of the default container.
- **Long-form forms (NewOrderPage, CustomerDetailPage edit mode):** Wrap the page; do NOT change form field styling. Forms stay neutral.
- **Pages that already have a heading element:** Replace it with the `JoyPageShell` `title` prop. Don't double-render headings.
- **Pages with multiple "primary" buttons in the header:** Pass them all via the `actions` slot.

## Out of Scope

- Restyling data tables (rows, headers, sort indicators, pagination controls).
- Restyling form fields, inputs, selects, checkboxes (those are project-wide concerns).
- Changing color tokens or adding new ones.
- Adding new animations or motion.
- Touching any print page.
- Touching any kiosk page (already done).
- Adding tests (this is a chrome-only sweep; no behavior to test).
- Migrating non-empty-state usages of `<EmptyState>` (those that are used as info chips or inline errors).

## Constraints

### Musts
- `cd web && npm run build` MUST exit 0 after the sweep is complete.
- `JoyPageShell` MUST honor `prefers-reduced-motion`.
- All 13 in-scope pages MUST be wrapped — partial sweep is rejected.
- No in-scope page may regress in functional behavior.
- Print pages MUST be untouched.

### Must-Nots
- Do NOT add dependencies.
- Do NOT modify `joy.css`, `index.css`, or `main.tsx`.
- Do NOT recolor data-encoding colors (status pills, charts).
- Do NOT touch routing, stores, types, or API clients.
- Do NOT delete `EmptyState` even after migrations — other pages and components may still use it.

### Preferences
- Prefer composition over prop explosion: if `JoyPageShell` needs a prop you can avoid by letting children render the affordance, prefer the children path.
- Prefer `SectionHeading level={3}` for sub-section headings inside pages.
- Prefer migrating `<EmptyState>` → `<BotanicalEmptyState>` than leaving the old one in place on an in-scope page.

### Escalation Triggers
- A page's existing layout breaks visibly when wrapped → stop, propose an opt-out variant.
- A data table needs restructuring to fit the wrapper → stop, leave the table as-is, escalate.
- The build fails and the cause is not obvious → stop and report.

## Verification

The dark factory verifier will run all commands listed under SS-01 "Verification commands" above. The implementer should also do a manual smoke test by running `cd web && npm run dev` and clicking through each of the 13 pages to confirm they render without console errors.

## Deployment Notes

This is a frontend-only chrome sweep. No migrations. No backend changes. No environment config. Standard deploy: rebuild web container, ship.

Rollback plan: revert the single sweep commit. Each wrapped page becomes un-wrapped and reverts to its prior chrome instantly.

## Approaches Considered

- **Per-page hand-rolled chrome (rejected):** Would have duplicated the paper-grain background, container padding, and heading typography across 13 files. Future restyles would require touching all 13 again.
- **Global app-shell wrapper in `App.tsx` (rejected):** Would have applied joy chrome to print pages and kiosk pages too, requiring a complex opt-out matrix. Per-page opt-in is auditable.
- **`JoyPageShell` (chosen):** Single shared component, per-page opt-in, one revert path, easy to introduce a new prop later (e.g., `actions` slot, `maxWidth` variants) without rippling into every page.

## Next Steps

1. Run this spec through the dark factory: `/forge:forge-dark-factory docs/specs/2026-04-26-joy-pass-back-office-sweep.md`
2. After it lands, manually click through every wrapped page in dev to spot any regressions the build couldn't catch.
3. (Optional follow-up) Restyle the data tables themselves in a separate spec — that's a deeper visual decision that benefits from real user feedback first.
