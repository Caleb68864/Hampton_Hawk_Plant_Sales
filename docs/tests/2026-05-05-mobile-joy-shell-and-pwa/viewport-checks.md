# Viewport Checks -- Mobile Joy Shell and PWA

Captures live-browser screenshots at the spec-required viewports plus desktop regression checks. These captures are inputs to `ss06-integration-evidence.md` for the visual-parity sign-off.

> **Pending capture.** SS-01–SS-05 build the implementation; the screenshots below need to be captured against the running app on a real device or a DevTools device toolbar. Replace each placeholder block with an embedded screenshot and one-line caption confirming the check.

## 375px (phone, default)

- [ ] `MobileHomePage` -- single-column home, paper background visible, Fraunces gold-italic emphasis, qa-card press bar.
- [ ] `MobileTopBar` -- 48px height, gradient hawk-700→hawk-950, gold-300 bottom border, hamburger visible.
- [ ] `MobileDrawer` open -- drawer ≤ 320px wide, scrim fills viewport, three distinct stacked layers (top bar / drawer / scrim) per SS-03 AC-11.
- [ ] `MobileConnectionRequiredScene` (DevTools offline).
- [ ] `MobileBackendUnavailableScene` (API stopped).
- [ ] `MobileAccessDeniedScene` (signed in as `POS`-only) -- no drawer rendered.
- [ ] Shared `/login` -- paper background + `MobilePrimaryButton`.

## 430px (large phone)

- [ ] `MobileHomePage` -- still single-column, no horizontal overflow.
- [ ] Greeting + connection dot + first qa-card visible above the fold.

## 768px (tablet)

- [ ] `MobileTopBar` -- 56px height, hamburger hidden (per SS-03 AC-12).
- [ ] `MobileTabletRail` rendered persistently at ~220px, hawk-50 background.
- [ ] `MobileHomePage` -- two-column home (greeting + ribbon + primary CTA on left; stats + quick-actions on right).

## 1024px (tablet wide)

- [ ] Same expectations as 768px; confirm no overflow at 1024px.

## Desktop regression (≥ 1280px)

- [ ] `/pickup` -- existing `AppLayout` and pickup page unchanged.
- [ ] `/pickup/:orderId` -- existing layout unchanged.
- [ ] `/lookup-print` -- existing layout unchanged.
- [ ] `/orders` -- existing layout unchanged.
- [ ] `/reports` -- existing layout unchanged.
- [ ] Kiosk routes -- still render through `KioskLayout` and `KioskRouteGuard`.
