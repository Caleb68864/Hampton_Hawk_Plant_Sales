---
ss: SS-01
title: Mobile Theme Token Evidence
---

# SS-01 Theme Evidence

Each `--mobile-*` alias and the existing token it resolves to:

| Mobile Alias | Resolves To | Raw Value |
|---|---|---|
| `--mobile-surface` | `var(--joy-paper)` | `#fbf7ee` (defined in `web/src/styles/joy.css`) |
| `--mobile-surface-elevated` | `var(--color-gold-50)` | `#fdf9ef` (defined in `web/src/index.css` @theme) |
| `--mobile-rule` | `var(--joy-rule)` | `rgba(102, 46, 128, 0.12)` (defined in `web/src/styles/joy.css`) |
| `--mobile-touch-min` | `56px` | New value — minimum touch target per joy spec |
| `--mobile-radius` | `16px` | New value — standard corner radius for mobile cards |

## Gradient Colors

The radial gradients in `.mobile-page-bg::after` reference:

- `var(--color-hawk-50)`: `#f8f4fa` — Hampton Hawks brand purple tint
- `var(--color-gold-50)`: `#fdf9ef` — Hampton Hawks gold tint

Both are defined in the `@theme` block in `web/src/index.css`. No standalone hex literals were introduced.

## Dot-grain Overlay

The grain dot color `rgba(68, 29, 85, 0.045)` matches the existing `.paper-grain::before` implementation
in `web/src/styles/joy.css`. The specific `--color-hawk-900` value is `#441d55` which equals `rgb(68, 29, 85)`.
This is intentionally inlined as `rgba` to set a custom opacity on the dot rather than using `color-mix`.