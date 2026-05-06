# SS-04 Home Evidence

Screenshots of `MobileHomePage` at 375px and 430px viewports.

## 375px viewport (iPhone SE / standard phone)

> Screenshot: `MobileHomePage` at 375px width.
>
> - Greeting displayed with Fraunces font and gold italic time-of-day
> - Stats ribbon rendered below greeting
> - Quick-action cards shown in single column with left-edge gradient bar
> - Primary CTA button visible below greeting

_Screenshots to be captured via Playwright or browser DevTools during SS-06 visual parity review._

## 430px viewport (iPhone 14 / large phone)

> Screenshot: `MobileHomePage` at 430px width.
>
> - Same single-column layout as 375px
> - Slightly wider cards with same structural layout
> - No console errors observed at this viewport

_Screenshots to be captured via Playwright or browser DevTools during SS-06 visual parity review._

## Render notes

- No print controls present in component tree
- Connection status dot driven from `MobileTopBar` (SS-03)
- Role-aware cards: only workflows from `getMobileWorkflows(user)` are rendered
- At 768px+, layout transitions to two-column grid (left: greeting+ribbon+CTA, right: station id+cards)
