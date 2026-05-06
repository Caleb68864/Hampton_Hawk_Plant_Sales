# Factory Memory -- Mobile Joy Shell and PWA

## Stage Outputs

### Stage 3: Prep
- Artifact: `docs/specs/2026-05-05-mobile-joy-shell-and-pwa/` (6 phase specs + index.md)
- Sub-specs refined:
  - SS-01: Joy Mobile Theme Layer (tokens, typography, paper background)
  - SS-02: Mobile Route Skeleton, Auth Integration, Role-Aware Config
  - SS-03: Mobile Layout Shell (top bar, drawer, tablet rail, page transitions)
  - SS-04: Mobile Station Home, Joy Moments, Scan Input Shell
  - SS-05: Online-Only Guard, Joy Scenes, PWA Manifest + Install
  - SS-06: Integration, Verification, Documentation
- Interface contracts identified:
  - SS-01 provides `--mobile-*` CSS aliases + `MobilePageBackground` consumed by SS-03/SS-04/SS-05.
  - SS-02 provides `MobileWorkflowEntry`, `getMobileWorkflows`, `userHasMobileAccess`, `MobileRouteGuard` consumed by SS-03 (modifies guard) and SS-04 (consumes workflows).
  - SS-03 provides `MobileLayout`, `MobileTopBar`, `MobileDrawer`, `MobileTabletRail`, `MobilePageTransition` -- SS-04 modifies layout to add JoyAriaLiveProvider; SS-05 modifies layout to wire hooks.
  - SS-04 provides `MobilePrimaryButton`/`MobileGoldButton`/`MobileGhostButton`, `Checkbloom`/`Stamp`/`Seed`, `JoyAriaLive`, `ScanInputShell`, `MobileQuickActionCard` consumed by SS-05 scenes and shared LoginPage restyle.
  - SS-05 provides `useOnlineStatus`, `useBackendAvailability`, three Joy scenes, manifest + icons.
  - SS-06 provides documentation only.
- Patterns found in codebase:
  - Tailwind v4 `@theme` block in `web/src/index.css` for color/font tokens.
  - Joy tokens namespaced as `--joy-*` in `web/src/styles/joy.css` (NOT bare `--paper` as master spec context implied).
  - Route-config pattern: `web/src/routes/kioskRouteConfig.ts` + colocated `*.test.ts`.
  - Guard pattern: `web/src/routes/RoleRoute.tsx` (renders `<Outlet />` or fallback).
  - Layout pattern: `web/src/layouts/AppLayout.tsx` (gradient header with crest dot + `<Outlet />`).
  - Hook pattern: `web/src/hooks/useKioskNavigation.ts`.
  - Test framework: `node --test --experimental-strip-types` per `web/package.json` `"test"` script.
- Build command: `cd web && npm run build` (web) and `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` (api)
- Test command: `cd web && node --test --experimental-strip-types <file>` (project does NOT have vitest)

## Issues Log

- Stage 3 INFO: Master spec specifies `npx vitest run ...` for unit tests; project uses `node --test --experimental-strip-types ...`. Phase specs replace the command everywhere and call out the substitution in each MECHANICAL acceptance criterion.
- Stage 3 INFO: Master spec context mentions tokens `--paper`, `--ink`, `--rule`, `--plum-shadow`, `--press-shadow` as existing in `web/src/index.css`. Actual file location is `web/src/styles/joy.css` and tokens are namespaced `--joy-paper`, etc. Phase specs reference the real `--joy-*` names.
- Stage 3 INFO: Master spec lists `web/src/pages/Login.tsx` for SS-05. Actual file is `web/src/pages/auth/LoginPage.tsx`. SS-05 uses the correct path.
- Stage 3 BLOCKER (potential): `web/src/types/auth.ts` currently exports `AppRole = 'Admin' | 'Volunteer'`. Mobile spec references `Pickup`, `LookupPrint`, `POS`, `Reports`. SS-02 includes a pre-flight gate that halts if the auth-spec role expansion has not landed before SS-02 runs.
- Stage 3 INFO: No dedicated `/health` endpoint confirmed. SS-05 worker may need to escalate to pick a suitable lightweight endpoint or add one to the API.
