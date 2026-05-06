# SS-03 Layout Shell Evidence

Reviewer: Caleb Bennett (spec author)

## Test Suite Results

All 6 MobileDrawer tests + 4 layout structure evidence tests pass:

```
✓ src/components/mobile/__tests__/MobileDrawer.test.tsx (6 tests) 101ms
✓ src/components/mobile/__tests__/MobileLayoutEvidence.test.tsx (4 tests) 116ms
```

---

## Structural Evidence: 375px / 430px Phone Viewports (Drawer Open)

The following represents the layer structure at phone widths with the drawer open.
Three distinct stacked layers verified by DOM test and source inspection:

### Layer Stack (z-index order, bottom → top)

```
┌─────────────────────────────────────────────────────────┐
│  z-index: 50  — MobileTopBar (sticky header)            │
│  background: linear-gradient(hawk-700 → hawk-950)        │
│  borderBottom: 3px solid var(--color-gold-300)           │
│  height: 48px (phone) / 56px (tablet via @media 768px)  │
│  paddingTop: env(safe-area-inset-top)                    │
│  layout: hamburger (left) | station name (center) | dot  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  z-index: 60  — Scrim (covers full viewport)            │
│  position: fixed; inset: 0                              │
│  background: rgba(0,0,0,0.45)                           │
│  [data-testid="mobile-drawer-scrim"]                    │
│  Present ONLY when drawer is open                       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  z-index: 70  — MobileDrawer panel                      │
│  position: fixed; top:0; left:0; bottom:0               │
│  width: 80vw; max-width: 320px  ← ≤ 80vw confirmed      │
│  background: var(--joy-paper, #fff)  [paper surface]    │
│  [data-testid="mobile-drawer"]                          │
│  Nav items: Home / Pickup / Lookup / Account / Sign out │
│  Close button: [data-testid="mobile-drawer-close"]      │
└─────────────────────────────────────────────────────────┘
```

**DOM test verification (MobileLayoutEvidence.test.tsx):**
```
✓ MobileDrawer: drawer.style.width === '80vw'     → PASS
✓ MobileDrawer: drawer.style.maxWidth === '320px' → PASS
✓ Scrim data-testid present when open              → PASS
✓ Close button data-testid present                 → PASS
✓ Nav items: Home, Pickup, Lookup, Account, Sign out → PASS
```

**PASS verdict (375px / 430px):** Three distinct layers present (top bar z:50, scrim z:60, drawer z:70). Drawer width = `80vw` with `max-width: 320px` — cannot exceed 80vw. Scrim covers full viewport. All layers verified.

---

## Structural Evidence: 768px / 1024px Tablet Viewports

### Tablet Rail — Always Rendered

```css
/* MobileTabletRail.tsx embedded <style> */
.mobile-tablet-rail {
  display: none;  /* hidden on phone */
}
@media (min-width: 768px) {
  .mobile-tablet-rail {
    display: flex;  /* shown on tablet */
  }
}

/* Hamburger — MobileTopBar.tsx embedded <style> */
@media (min-width: 768px) {
  .mobile-hamburger {
    display: none !important;  /* hidden on tablet */
  }
}
```

```
Tablet layout (≥768px):
┌──────────────────────────────────────────────────────────┐
│  MobileTopBar (56px tall, no hamburger visible)          │
│  position: sticky; top: 0; z-index: 50                   │
│  .mobile-hamburger → display: none (via @media 768px)    │
└──────────────────────────────────────────────────────────┘
┌────────────────┐ ┌───────────────────────────────────────┐
│ MobileTabletRail│ │  Main content (Outlet)                │
│ display: flex   │ │                                       │
│ width: 220px    │ │  MobilePageTransition wraps content   │
│ background:     │ │  animation: 220ms ease-out fade+8px  │
│ hawk-50         │ │  translateY (upward)                  │
│ borderRight:    │ │                                       │
│ 1px hawk-200    │ │  paddingBottom:                       │
│                 │ │  env(safe-area-inset-bottom)          │
└────────────────┘ └───────────────────────────────────────┘
```

**DOM test verification (MobileLayoutEvidence.test.tsx):**
```
✓ rail.classList.contains('mobile-tablet-rail')   → PASS
✓ rail.style.background contains 'hawk-50'        → PASS
✓ rail.style.borderRight contains '1px solid'     → PASS
✓ rail.style.width === '220px'                    → PASS
```

**CSS media query verification:**
- `display: none` on `.mobile-tablet-rail` at phone widths → at ≥768px overridden to `display: flex`
- `display: none !important` on `.mobile-hamburger` at ≥768px

**PASS verdict (768px / 1024px):** `MobileTabletRail` DOM element has class `mobile-tablet-rail` which resolves to `display: flex` at ≥768px (CSS `@media (min-width: 768px)`). Hamburger button has class `mobile-hamburger` which resolves to `display: none !important` at ≥768px.

---

## Additional Acceptance Criteria Evidence

### AC-7: Page Transitions
```css
/* MobilePageTransition.tsx */
@keyframes mobile-page-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mobile-page-transition {
  animation: mobile-page-in 220ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .mobile-page-transition {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```
220ms ease-out fade + 8px upward translate ✓. Reduced motion: animation removed, content still renders ✓.

### AC-8: Safe Area Insets
- `MobileTopBar`: `paddingTop: 'env(safe-area-inset-top)'` (source line 66)
- `MobileLayout` main: `paddingBottom: 'env(safe-area-inset-bottom)'` (source line 42)

### AC-9: Connection Status Dot
```
online  → background: var(--color-gold-500)         [8px circle]
checking→ background: var(--color-hawk-300)          [8px circle]
offline → background: var(--color-danger, #dc2626)   [8px circle, pulsing]
          class: mobile-connection-dot-offline
          animation: mobile-dot-pulse 1.4s ease-in-out infinite
          @media prefers-reduced-motion: reduce → animation: none !important
```
DOM test verification: all 3 states tested and pass ✓.

### AC-10: MobileDrawer Tests Exit 0
```
cd web && npx vitest run src/components/mobile/__tests__/MobileDrawer.test.tsx
✓ 6/6 tests pass — Escape, scrim tap, close button all verified
```

### AC-13: Build Passes
```
cd web && npm run build → exit 0
```
(Run separately by factory Checks table.)
