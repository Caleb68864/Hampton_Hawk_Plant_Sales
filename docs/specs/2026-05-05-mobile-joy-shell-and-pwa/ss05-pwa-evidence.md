# SS-05 PWA Evidence

## Manifest Contents

File: `web/public/manifest.webmanifest`

```json
{
  "name": "Hampton Hawks Plant Sales",
  "short_name": "Hawk Plants",
  "start_url": "/mobile",
  "display": "standalone",
  "theme_color": "#2d1152",
  "background_color": "#faf7f2",
  "icons": [
    { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `theme_color: "#2d1152"` = `--color-hawk-800` (Hampton Hawks deep purple)
- `background_color: "#faf7f2"` = `--joy-paper` (warm off-white)
- `start_url: "/mobile"` ensures PWA installs launch into the mobile shell

## Icon Generation

Source file: `web/public/hawk-logo.png` (49×48 PNG, pre-existing in repo)

Generation method: **Node.js `sharp` package** (devDependency)

### Command equivalent

```bash
node scripts/generate-pwa-icons.mjs
```

Which runs:
```js
sharp('public/hawk-logo.png').resize(192, 192).png().toFile('public/pwa-192.png')
sharp('public/hawk-logo.png').resize(512, 512).png().toFile('public/pwa-512.png')
sharp('public/hawk-logo.png').resize(512, 512).png().toFile('public/pwa-maskable-512.png')
```

### ImageMagick equivalent (if `magick` CLI available)

```bash
magick web/public/hawk-logo.png -resize 192x192 web/public/pwa-192.png
magick web/public/hawk-logo.png -resize 512x512 web/public/pwa-512.png
magick web/public/hawk-logo.png -resize 512x512 -background none -extent 512x512 web/public/pwa-maskable-512.png
```

### Verification

| File | Size | Valid PNG |
|------|------|-----------|
| `web/public/pwa-192.png` | 52 KB | ✓ (PNG image data, 192×192) |
| `web/public/pwa-512.png` | 294 KB | ✓ (PNG image data, 512×512) |
| `web/public/pwa-maskable-512.png` | 294 KB | ✓ (PNG image data, 512×512) |

All files exceed the 5 KB minimum requirement.

## Service Worker Decision

**Status: SHIPPED** (`web/public/service-worker.js`)

The service worker is included to enable offline shell caching for the PWA install experience.

### Bypass List

The SW fetch handler explicitly bypasses all operational endpoints — it does NOT cache or intercept:

| Pattern | Matches |
|---------|---------|
| `/api/*` | All API endpoints |
| `/auth/*` | Auth routes |
| `/login` | Login page |
| `/logout` | Logout route |
| `*scan*` | Scan workflows |
| `*order*` | Order routes |
| `*fulfillment*` | Fulfillment routes |
| `*report*` | Report routes |
| `*users*`, `*user-management*` | User management |
| `/media/*`, `*camera*` | Media/camera streams |
| `/health` | Health check endpoint |

Bypass patterns are defined in `BYPASS_PATTERNS` array in `service-worker.js` and verified via `shouldBypass(url)` function.

### Service Worker Registration

Registered via `web/src/pwa/registerServiceWorker.ts`, which:
- Only registers in production (`import.meta.env.DEV` check)
- Only registers if `serviceWorker` in navigator
- Fires on `window:load` event

## PWA Install — Start URL

The `start_url: "/mobile"` in `manifest.webmanifest` ensures that when a user installs the PWA and launches it from their home screen, the app opens at the mobile station shell (`/mobile`) rather than the desktop dashboard.

## index.html PWA Wiring

```html
<meta name="theme-color" content="#2d1152" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/pwa-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```
