# SS-06 Integration Evidence

Cross-cutting integration evidence for `2026-05-05-mobile-joy-shell-and-pwa.md`. References the per-sub-spec evidence files and records the visual-parity checklist defined by master-spec SS-06 AC-12.

## Sub-spec evidence index

- SS-01 -- `ss01-theme-evidence.md` (mobile theme tokens, typography utilities, page background)
- SS-02 -- mobile route branch + role-aware workflow config (no separate evidence file; verified by `mobileRouteConfig.test.ts` and the build)
- SS-03 -- `ss03-layout-evidence.md` (top bar, drawer, tablet rail, page transitions)
- SS-04 -- `ss04-home-evidence.md` (home page, joy moments, scan input shell, button variants)
- SS-05 -- `ss05-pwa-evidence.md` (online + backend hooks, three Joy scenes, PWA manifest + icons + service worker bypass list, paper-themed login)

## Mechanical builds

- `cd web && npm run build` -- exits 0 (run on `2026/05/06-0251-caleb-feat-mobile-joy-shell-and-pwa`, 56 changed files, 5044 insertions).
- `cd api && dotnet build HamptonHawksPlantSales.sln --no-restore -v quiet` -- TODO: confirm green on the final merge commit.

## Integration matrix (master-spec SS-06 AC-1 .. AC-8)

> Pending live-browser confirmation. Each row needs a captured screenshot or DevTools snapshot.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `Pickup` role on `/mobile` -> home + pickup card; no print controls | pending | screenshot in `viewport-checks.md` |
| 2 | `POS`-only on `/mobile` -> access-denied scene; no drawer | pending | screenshot in `viewport-checks.md` |
| 3 | Unauthenticated -> shared `/login` -> back to `/mobile` | pending | manual run-through |
| 4 | DevTools offline -> connection-required scene; restore -> home returns | pending | screenshot pair |
| 5 | API down -> backend-unavailable scene; retry restores home | pending | screenshot pair |
| 6 | `/pickup`, `/pickup/:orderId`, `/lookup-print`, `/orders`, `/reports`, kiosk routes unchanged | pending | desktop regression captures in `viewport-checks.md` |
| 7 | Reduced motion suppresses `Checkbloom` / `Stamp` / `Seed` / page transitions / qa-card press bar | pending | side-by-side capture |
| 8 | `JoyAriaLive` announces auth, connection, and joy-moment events | pending | accessibility tree capture |

## Visual parity checklist (master-spec SS-06 AC-12)

Apply the tolerance rules from master spec AC-12 (color ±5 RGB / ±2% HSL; geometric ±1px ≤16px / ±2px >16px; typography family substring match; gradients ±2% stop position; discrete props exact). Reviewer: spec author Caleb Bennett.

| Row | Token reference | Computed-style snapshot | Screenshot pair | Verdict |
|-----|-----------------|------------------------|-----------------|---------|
| Header gradient (`--color-hawk-700` -> `--color-hawk-950`, 3px `--color-gold-300` border) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Paper background (`--joy-paper` `#fbf7ee` + `data-mobile-bg` grain) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Typography -- Fraunces (H1/H2 includes `Fraunces`; gold-italic emphasis present) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Typography -- Manrope (body includes `Manrope`) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Button treatments (`MobilePrimaryButton`/`MobileGhostButton`/`MobileGoldButton` resolve to demo tokens within tolerance) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Scene cards (warm card uses `--color-gold-50`; matching radius/shadow tokens) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Eyebrow labels (letter-spacing within ±1px; exact `text-transform`; color token within tolerance) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Focus ring (color within tolerance; width within geometric tolerance) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Seed empty-state (paper variant on most scenes; hawk-tinted on `MobileAccessDeniedScene`) | _capture pending_ | _capture pending_ | _capture pending_ | pending |
| Page transitions (220ms fade + 8px translate; suppressed under reduce-motion) | _capture pending_ | _capture pending_ | _capture pending_ | pending |

`accepted-deviation` rows (if any) MUST cite the deliberate token swap and rationale here.

## Pending follow-ups

- Live-browser viewport screenshots captured into `viewport-checks.md`.
- API solution build (`dotnet build HamptonHawksPlantSales.sln`) confirmed green post-merge.
- PWA install captured on a real phone or supported browser; URL on launch confirmed as `/mobile`.
