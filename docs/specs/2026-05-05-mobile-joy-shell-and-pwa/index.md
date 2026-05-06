---
type: phase-spec-index
master_spec: "docs/specs/2026-05-05-mobile-joy-shell-and-pwa.md"
date: 2026-05-05
sub_specs: 6
---

# Mobile Joy Shell and PWA -- Phase Specs

Refined from [2026-05-05-mobile-joy-shell-and-pwa.md](../2026-05-05-mobile-joy-shell-and-pwa.md).

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Joy Mobile Theme Layer (tokens, typography, paper background) | none | [sub-spec-1-joy-mobile-theme-layer.md](sub-spec-1-joy-mobile-theme-layer.md) |
| 2 | Mobile Route Skeleton, Auth Integration, and Role-Aware Config | 1 | [sub-spec-2-mobile-route-skeleton-auth-and-role-config.md](sub-spec-2-mobile-route-skeleton-auth-and-role-config.md) |
| 3 | Mobile Layout Shell: Top Bar, Drawer, Tablet Rail, Page Transitions | 1, 2 | [sub-spec-3-mobile-layout-shell-top-bar-drawer-rail.md](sub-spec-3-mobile-layout-shell-top-bar-drawer-rail.md) |
| 4 | Mobile Station Home, Quick-Action Cards, Joy Moments, Scan Input Shell | 1, 2, 3 | [sub-spec-4-mobile-station-home-joy-moments-scan-input.md](sub-spec-4-mobile-station-home-joy-moments-scan-input.md) |
| 5 | Online-Only Guard, Joy Connection/Access/Login Scenes, PWA Manifest + Install | 1, 2, 3, 4 | [sub-spec-5-online-only-guard-joy-scenes-pwa-manifest.md](sub-spec-5-online-only-guard-joy-scenes-pwa-manifest.md) |
| 6 | Integration Wiring, Verification, and Documentation | 1, 2, 3, 4, 5 | [sub-spec-6-integration-verification-and-documentation.md](sub-spec-6-integration-verification-and-documentation.md) |

## Execution

Run `/forge-run docs/specs/2026-05-05-mobile-joy-shell-and-pwa/` to execute all phase specs.

Run `/forge-run docs/specs/2026-05-05-mobile-joy-shell-and-pwa/ --sub N` to execute a single sub-spec.

## Spec Issues Flagged During Prep

These were discovered during codebase analysis and should be reviewed before kicking off SS workers:

1. **Test framework mismatch.** Master spec text uses `npx vitest run ...` for all unit tests. The project does NOT have vitest installed; `web/package.json` `"test"` script uses `node --test --experimental-strip-types ...`. All phase specs replace `npx vitest` with the project's actual `node --test` command. If vitest is intended, install it before running SS-01..SS-05.
2. **AppRole expansion dependency.** `web/src/types/auth.ts` currently exports `AppRole = 'Admin' | 'Volunteer'`. The mobile spec references `Pickup`, `LookupPrint`, `POS`, `Reports` from the auth spec. SS-02 includes a pre-flight gate that halts if the auth-spec role expansion has not landed.
3. **Joy tokens namespace.** Master spec context says tokens like `--paper`, `--ink`, `--rule`, `--plum-shadow`, `--press-shadow` exist in `web/src/index.css`. They actually live in `web/src/styles/joy.css` namespaced as `--joy-paper`, `--joy-ink`, etc. Phase specs reference the actual `--joy-*` names.
4. **LoginPage path.** Master spec lists `web/src/pages/Login.tsx`. Actual file is `web/src/pages/auth/LoginPage.tsx`. SS-05 uses the correct path.
5. **Health endpoint.** SS-05 must pick a lightweight endpoint for backend availability. No dedicated `/health` is confirmed -- worker should escalate if no suitable endpoint exists.
