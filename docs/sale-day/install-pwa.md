---
title: Install Hawk Plants On A Phone (Add To Home Screen)
audience: volunteer / sale-day supervisor
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md
---

# Install Hawk Plants On A Phone

The mobile app is a Progressive Web App (PWA). There is no app store. You
install it by opening the URL in your browser and adding it to the home
screen. Once installed it launches in standalone mode (no browser address
bar) directly into `/mobile`.

The deployment URL is `<sale-day-endpoint TBD>` -- ops will hand you the real
URL during sale-day setup.

## Before you start

- Phone is connected to the sale-day Wi-Fi.
- You can open `<sale-day-endpoint TBD>/mobile` in a browser and see the
  Hawk Plants login page (purple gradient header, gold border, "Hampton
  Hawks Plant Sales" wordmark).

## iPhone -- Safari only

Chrome on iOS uses Safari's engine, but Add-to-Home-Screen only behaves as a
PWA when launched from **Safari**. Use Safari on iPhone.

1. Open Safari.
2. Type `<sale-day-endpoint TBD>/mobile` into the address bar.
3. Tap the **Share** icon (square with arrow pointing up, in the bottom
   toolbar).
4. Scroll down in the share sheet and tap **Add to Home Screen**.

   ```
   +-------------------------------+
   |   [screenshot placeholder:    |
   |    iOS share sheet with       |
   |    "Add to Home Screen" row   |
   |    highlighted]               |
   +-------------------------------+
   ```

5. Confirm the icon name is **Hawk Plants** (or "Hampton Hawks Plant Sales"
   on older iOS) and tap **Add** in the top-right.

   ```
   +-------------------------------+
   |   [screenshot placeholder:    |
   |    Add to Home Screen sheet   |
   |    showing icon + name +      |
   |    "Add" button]              |
   +-------------------------------+
   ```

6. The home screen now shows a **Hawk Plants** icon with a leafy hawk logo.
   Tap it.
7. The app launches **without** the Safari address bar. This is "standalone
   mode" and confirms the PWA install worked.

## Android -- Chrome

1. Open Chrome.
2. Type `<sale-day-endpoint TBD>/mobile` into the address bar.
3. Chrome may show an **Install Hawk Plants** banner along the bottom; tap
   **Install** if it does. If not, tap the three-dot menu in the top-right
   and select **Install app** (or **Add to Home screen** on older Chrome).

   ```
   +-------------------------------+
   |   [screenshot placeholder:    |
   |    Chrome menu with           |
   |    "Install app" highlighted] |
   +-------------------------------+
   ```

4. Confirm in the dialog by tapping **Install**.
5. The home screen (or app drawer) now shows a **Hawk Plants** icon. Tap it.
6. The app launches **without** the Chrome address bar.

## Verify standalone display

Whatever platform: after launching from the home-screen icon, you should
see:

- Purple gradient header bar with the gold underline.
- "Hampton Hawks Plant Sales" wordmark in Fraunces.
- **No** browser address bar visible.
- Pinching does not zoom the page (mobile shell uses fixed-viewport layout).
- The status bar shows the system time / battery, not browser chrome.

If you still see the browser address bar, the install did not succeed -- try
again, ensuring you tapped Add to Home Screen / Install rather than just
bookmarking.

## Uninstall

### iPhone

1. Long-press the **Hawk Plants** icon on the home screen.
2. Tap **Remove App** -> **Delete from Home Screen**.

(This does not delete data on the server; it only removes the icon and
clears the local cache the PWA wrote.)

### Android

1. Long-press the **Hawk Plants** icon.
2. Drag to **Uninstall** at the top of the screen, or tap the **i**
   (information) and choose **Uninstall**.

## What if the install banner does not appear?

| Symptom | Cause | Fix |
|---------|-------|-----|
| Chrome shows no Install banner | Page was opened over plain HTTP | Re-open over HTTPS (see `deployment.md`) |
| Safari Share sheet has no "Add to Home Screen" row | Page is in a private tab | Re-open in a regular Safari tab |
| Icon installs but launches with the address bar | Manifest is broken / 404 | Confirm `<sale-day-endpoint TBD>/manifest.webmanifest` returns valid JSON |
| Icon installs but launches `/` instead of `/mobile` | Manifest `start_url` is wrong | Should be `/mobile`; check `web/public/manifest.webmanifest` |

## Related

- `device-checklist.md` -- the rest of what each phone needs.
- `deployment.md` -- where the URL comes from in the first place.
