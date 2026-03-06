# Hampton Hawks Plant Sales -- Device-Local Kiosk Mode

## Meta

| Field | Value |
|-------|-------|
| Client | Personal / School Fundraiser |
| Project | Hampton Hawks Plant Sales |
| Repo | Hampton_Hawk_Plant_Sales |
| Date | 2026-03-06 |
| Author | Codex |
| Quality | 28/30 |
| Outcome Clarity | 5 |
| Scope Boundaries | 5 |
| Decision Guidance | 4 |
| Edge Coverage | 4 |
| Acceptance Criteria | 5 |
| Decomposition | 5 |

## Outcome

Add a PIN-protected kiosk mode that locks a single browser/device into a volunteer-safe station workflow. The first release supports two profiles, `Pickup` and `Lookup & Print`, and keeps kiosk state local to that device so one station can be locked down without changing the rest of the event floor.

Done means an admin can enable or disable kiosk mode from Settings on one workstation, the selected profile survives refresh on that workstation only, blocked routes bounce back to the allowed station route, and volunteers no longer see the full app shell or unrelated workflows while operating that station.

## Intent

### Trade-off Hierarchy

1. Volunteer simplicity and wrong-screen prevention over preserving the current all-in-one shell.
2. Device-local behavior over shared global settings.
3. Reuse existing admin PIN patterns where they fit, but do not fake authorization client-side.
4. Keep the first release narrow (`Pickup`, `Lookup & Print`) rather than shipping half-finished profiles for every station.
5. Prefer additive UI layers and route guards over risky rewrites of core order and fulfillment logic.

### Decision Boundaries

- Prefer a dedicated station page over exposing a general-purpose page with buttons hidden.
- Prefer route allowlists over visual-only hiding; kiosk mode must be enforced on refresh and direct URL entry.
- Prefer graceful degradation for fullscreen or popup behavior; the workflow must still function if browser APIs are blocked.
- Stop and ask only if the requirement expands into remote multi-device control, OS-level kiosk lockdown, per-user accounts, or a first-release `Walk-Up` kiosk profile.

## Context

This spec is grounded in the current codebase and a live UI audit of the running app.

### Relevant Existing Surfaces

- `web/src/layouts/AppLayout.tsx` always shows the full top navigation and global quick find.
- `web/src/pages/station/StationHomePage.tsx` already models station choices, but it is only a chooser page and does not lock the device into one workflow.
- `web/src/pages/SettingsPage.tsx` currently exposes only the global `Sale Closed` setting.
- `web/src/stores/authStore.ts`, `web/src/hooks/useAdminAuth.ts`, and `web/src/components/shared/AdminPinModal.tsx` already provide the admin PIN collection flow on the frontend.
- `api/src/HamptonHawksPlantSales.Api/Filters/AdminPinActionFilter.cs` validates PINs server-side only when an API endpoint is actually called.

### Audit Findings That Shape This Plan

- Kiosk mode cannot live in shared app settings. If it is stored globally, enabling kiosk on one browser would affect every workstation.
- The current `Pickup` scan screen has a misleading recovery path: `Back to Lookup` currently navigates to `/station`, not back to `/pickup`, which breaks operator context.
- The current `Orders` page is too broad for invoice-handoff volunteers because it exposes navigation and actions unrelated to lookup and printing.
- `WalkUpNewOrderPage` currently crashes on direct load due to a null `preselectedItems` read. This makes `Walk-Up` a poor first kiosk profile and means kiosk flows must not route volunteers there.
- Print views and pickup/lookup fundamentals already work well enough to support a locked-down station experience.

## Requirements

1. Kiosk mode must be enabled and disabled per browser/device, not globally for the application.
2. Enabling or disabling kiosk mode must require a valid admin PIN validated by the API.
3. The first release must support two kiosk profiles only:
   - `Pickup`
   - `Lookup & Print`
4. Kiosk state must survive page refresh and browser reopen on the same device.
5. When kiosk mode is active, the app must render a kiosk shell without the normal top nav and without global quick find.
6. When kiosk mode is active, disallowed routes must redirect to that profile's landing page even on manual URL entry or refresh.
7. `Pickup` kiosk must allow only pickup lookup, pickup scan, and required print surfaces.
8. `Lookup & Print` kiosk must use a dedicated station-safe page focused on search and printing, not the general `Orders` page.
9. The settings UI must clearly separate global sale controls from device-local kiosk controls so admins do not confuse the two.
10. Browser fullscreen may be offered as an option, but kiosk mode must still work if fullscreen is denied or unsupported.
11. Printing must remain available from kiosk mode without exposing unrelated navigation.
12. Kiosk flows must not send volunteers into known unsafe or broken workflows such as the current direct-load `Walk-Up` path.
13. Existing business rules for `Sale Closed`, pickup scanning, printing, and admin actions must continue to work unchanged outside kiosk mode.

## Sub-Specs

### 1. Device-Local Kiosk Session + Admin Authorization

**Scope:** Add the data model and UI for kiosk mode as a device-local concept, plus a server-backed admin authorization step that can validate a PIN before local kiosk state is changed.

**Files:**
- `web/src/stores/kioskStore.ts` (new)
- `web/src/types/kiosk.ts` (new)
- `web/src/api/admin.ts` (new or folded into existing admin API surface)
- `web/src/pages/SettingsPage.tsx`
- `web/src/components/shared/AdminPinModal.tsx`
- `api/src/HamptonHawksPlantSales.Api/Controllers/AdminActionsController.cs`
- `api/src/HamptonHawksPlantSales.Core/DTOs/AdminDtos.cs`
- `api/src/HamptonHawksPlantSales.Core/Interfaces/IAdminService.cs`
- `api/src/HamptonHawksPlantSales.Infrastructure/Services/AdminService.cs`
- `api/tests/HamptonHawksPlantSales.Tests/Services/AdminActionsControllerTests.cs`

**Acceptance Criteria:**
1. `[STRUCTURAL]` A persisted kiosk session model exists in the web app with at least `enabled`, `profile`, `workstationName`, `enabledAt`, and optional `preferFullscreen`.
2. `[STRUCTURAL]` The supported profile enum or union includes `pickup` and `lookup-print` and is designed so future profiles can be added without reshaping persisted data.
3. `[BEHAVIORAL]` From Settings, an admin can choose a workstation profile, enter a valid PIN, and enable kiosk mode on the current browser only.
4. `[BEHAVIORAL]` With an invalid or missing PIN, kiosk mode does not activate and the user sees a clear failure message.
5. `[BEHAVIORAL]` Disabling kiosk mode also requires valid admin authorization and clears the persisted kiosk session from that browser only.
6. `[BEHAVIORAL]` A second browser or device remains unaffected when kiosk mode is enabled on the first one.
7. `[STRUCTURAL]` The Settings page presents kiosk mode inside a clearly labeled `This Device` section, separate from the global `Sale Status` section.
8. `[MECHANICAL]` Backend tests cover the admin authorization endpoint for valid and invalid PIN flows, and the web build passes.

**Dependencies:** none

---

### 2. Locked Kiosk Shell + Route Allowlist Enforcement

**Scope:** Introduce a kiosk-specific shell and route guard so kiosk mode is enforced by the router and layout, not only by hiding links.

**Files:**
- `web/src/App.tsx`
- `web/src/layouts/AppLayout.tsx`
- `web/src/layouts/KioskLayout.tsx` (new)
- `web/src/components/shared/GlobalQuickFind.tsx`
- `web/src/components/shared/QuickFindOverlay.tsx`
- `web/src/routes/kioskRouteConfig.ts` (new)
- `web/src/routes/KioskRouteGuard.tsx` (new)
- `web/src/hooks/useKioskNavigation.ts` (new, if helpful)

**Acceptance Criteria:**
1. `[STRUCTURAL]` There is a single source of truth that maps each kiosk profile to:
   - landing route
   - allowed in-app routes
   - allowed print routes
2. `[BEHAVIORAL]` When kiosk mode is inactive, the current full app shell behaves as it does today.
3. `[BEHAVIORAL]` When kiosk mode is active, the normal top nav and global quick find are not rendered.
4. `[BEHAVIORAL]` If a kiosk user manually browses to a blocked route such as `/orders`, `/imports`, or `/settings`, they are redirected back to the active kiosk landing route.
5. `[BEHAVIORAL]` Refreshing the browser while on an allowed kiosk route preserves kiosk mode and re-renders the kiosk shell.
6. `[BEHAVIORAL]` Allowed print routes remain reachable from kiosk mode without exposing the full shell before or after printing.
7. `[STRUCTURAL]` The kiosk shell exposes an obvious station label and an admin-only exit path, but does not expose unrelated app destinations.
8. `[MECHANICAL]` `npm run build` passes after kiosk layout and route guard wiring are introduced.

**Dependencies:** sub-spec 1

---

### 3. Station-Specific Pickup and Lookup/Print Experiences

**Scope:** Refine the station workflows so the two first-release kiosk profiles are actually safe for volunteers. This includes a dedicated `Lookup & Print` station page, pickup navigation fixes, kiosk-safe recovery actions, and operator-facing documentation.

**Files:**
- `web/src/pages/station/StationHomePage.tsx`
- `web/src/pages/pickup/PickupLookupPage.tsx`
- `web/src/pages/pickup/PickupScanPage.tsx`
- `web/src/pages/orders/OrdersListPage.tsx` (only if shared search logic should be extracted, not reused as the kiosk page)
- `web/src/pages/lookupprint/LookupPrintStationPage.tsx` (new)
- `web/src/components/shared/BackToStationHomeButton.tsx`
- `web/src/pages/DocsPage.tsx`
- `web/src/pages/print/PrintOrderPage.tsx`
- `web/src/pages/print/PrintSellerPacketPage.tsx`
- `docs/cheatsheets/pickup-station.md`
- `docs/cheatsheets/lookup-and-print.md`
- `docs/tests/` manual verification docs if the repo keeps scenario plans there

**Acceptance Criteria:**
1. `[BEHAVIORAL]` `Pickup` kiosk lands on the pickup lookup workflow, not on the station chooser.
2. `[BEHAVIORAL]` From the pickup scan page, the operator's `Back to Lookup` action returns to `/pickup`, not `/station`.
3. `[STRUCTURAL]` A dedicated `Lookup & Print` station page exists and only exposes:
   - search by customer, order number, or pickup code
   - print order sheet
   - print seller packet when relevant
   - station-safe empty and error states
4. `[BEHAVIORAL]` The `Lookup & Print` page does not expose create, edit, delete, imports, reports, or settings actions.
5. `[BEHAVIORAL]` No kiosk no-match or recovery path routes volunteers to the current broken `/walkup/new` flow.
6. `[STRUCTURAL]` Operator-facing copy uses station language that matches the assignment, for example `Pickup Station` and `Lookup & Print Station`, rather than generic admin terminology.
7. `[STRUCTURAL]` The in-app docs and printable cheat sheets explain how to start, use, and exit kiosk mode for pickup and lookup/print stations.
8. `[HUMAN REVIEW]` A first-time volunteer can identify the next safe action from the station heading, primary button labels, and recovery controls without needing the full app nav.
9. `[BEHAVIORAL]` Printing from a kiosk profile returns the operator to the same station workflow after print preview is closed.
10. `[MECHANICAL]` Manual verification steps are added or updated under `docs/tests/` so future audits can rerun the kiosk flows consistently.

**Dependencies:** sub-spec 2

## Edge Cases

1. **Browser refresh while kiosk is active**  
   The kiosk profile must reload from persisted state and reapply route restrictions immediately.

2. **Manual URL entry to a forbidden route**  
   The user must be redirected back to the active profile's landing page, not shown a partial page with hidden buttons.

3. **Fullscreen request denied by the browser**  
   Kiosk mode still activates; the UI may show a non-blocking message that fullscreen was not granted.

4. **Popup blocker affects print flows**  
   The UI must present a clear instruction to allow popups for print routes rather than silently failing.

5. **Invalid or expired local kiosk state after deployment**  
   Unknown or malformed stored profiles must be ignored safely and fall back to normal app mode.

6. **Multiple tabs on the same browser profile**  
   Because local storage is shared, enabling or disabling kiosk in one tab should be reflected across other open tabs on that device.

7. **`Sale Closed` while using a pickup kiosk**  
   The pickup station must still show the same sale-closed restrictions already enforced by the app; kiosk mode does not bypass operational rules.

8. **Lookup & Print station when no order is found**  
   The empty state must keep the volunteer inside that station workflow and offer only safe recovery actions such as retry search or print blank paperwork if that is still desired.

9. **Future `Walk-Up` kiosk request before current route defect is fixed**  
   Do not enable a `Walk-Up` kiosk profile until the direct-load `WalkUpNewOrderPage` crash is fixed and separately verified.

## Out of Scope

- OS-level browser lockdown, managed Chrome policies, or Windows Assigned Access.
- Remote control of kiosk mode across multiple stations from one admin console.
- Per-volunteer user accounts or role-based authentication.
- A first-release kiosk profile for `Walk-Up` or `Admin`.
- General cleanup of unrelated novice-user friction outside the kiosk workflows, unless the issue directly blocks `Pickup` or `Lookup & Print`.
- Fixing the existing `Walk-Up` direct-load crash as part of this spec, beyond ensuring kiosk users are never routed into it.

## Constraints

### Musts

- Use real server-side PIN validation before changing kiosk state.
- Keep kiosk mode local to the current device.
- Ship only `Pickup` and `Lookup & Print` as supported profiles in the first release.
- Enforce kiosk restrictions through routing and layout, not visual hiding alone.
- Keep existing sale controls and event-day business rules intact.

### Must-Nots

- Do not add kiosk mode as a shared flag to `api/settings` or other global app settings.
- Do not reuse the general `Orders` page as the volunteer-facing `Lookup & Print` station by merely hiding a few buttons.
- Do not leave `GlobalQuickFind` visible in kiosk mode.
- Do not expose imports, settings, reports, or broad CRUD navigation to kiosk volunteers.
- Do not add a `Walk-Up` kiosk profile until its route is stable on direct load.

### Preferences

- Reuse `AdminPinModal` and the current admin auth collection flow where practical.
- Use a persisted Zustand store for kiosk session state so the behavior is explicit and testable.
- Prefer dedicated station copy and dedicated station pages over generic power-user terminology.
- Keep backend change surface small; a focused authorization endpoint is better than a new global kiosk settings API.

### Escalation Triggers

- The requirement changes from device-local kiosk mode to centrally managed kiosk assignments.
- The event team wants true browser or OS lockdown beyond what the SPA can enforce.
- The first release must include a `Walk-Up` kiosk profile.
- Audit logging of kiosk entry/exit becomes mandatory and the existing `AdminAction` model cannot support it cleanly without schema changes.

## Verification

1. Start from a normal browser with no kiosk session stored. Open the app and confirm the standard shell still appears.
2. Open Settings and verify there are now two clearly separated sections:
   - global `Sale Status`
   - device-local `Kiosk Mode`
3. Enable `Pickup` kiosk with a valid admin PIN. Confirm the browser is redirected to the pickup workflow and the full nav disappears.
4. Refresh the browser. Confirm the `Pickup` kiosk stays active and the same kiosk shell remains in place.
5. Manually navigate to `/orders`. Confirm the app redirects back to the pickup landing page.
6. Open an order from pickup lookup, then use the scan-page `Back to Lookup` action. Confirm it returns to `/pickup`, not `/station`.
7. Disable kiosk mode with a valid admin PIN. Confirm the full shell returns on that browser.
8. On a second browser profile or device, confirm that enabling kiosk on the first device did not change anything on the second.
9. Enable `Lookup & Print` kiosk. Confirm the landing page supports search and print only, with no create/edit/import/settings actions.
10. Search for an existing order or customer in `Lookup & Print`, print an order sheet, and confirm closing print preview returns the volunteer to the same station workflow.
11. Trigger a no-match state in `Lookup & Print` and confirm the page remains station-safe and does not link to `/walkup/new`.
12. With `Sale Closed` enabled globally, confirm pickup kiosk still respects existing operational restrictions.
13. Run `cd web && npm run build`.
14. Run `cd api && dotnet test HamptonHawksPlantSales.sln --no-build -v quiet` after adding backend coverage for the authorization endpoint.
## Phase Specs

Refined by `/forge-prep` on 2026-03-06.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. Device-Local Kiosk Session + Admin Authorization | `docs/specs/kiosk-mode-station-profiles/sub-spec-1-kiosk-session-admin-auth.md` |
| 2. Locked Kiosk Shell + Route Allowlist Enforcement | `docs/specs/kiosk-mode-station-profiles/sub-spec-2-kiosk-shell-route-guard.md` |
| 3. Station-Specific Pickup and Lookup/Print Experiences | `docs/specs/kiosk-mode-station-profiles/sub-spec-3-station-workflows.md` |

Index: `docs/specs/kiosk-mode-station-profiles/index.md`

