# PWA Install Guide

Installing the Hampton Hawks Plant Sales app to your home screen gives you a full-screen, app-like experience without needing the App Store or Google Play. The app is a Progressive Web App (PWA) served from the sale day server.

The app manifest is located at `/manifest.webmanifest` on the sale day server. The primary mobile launch target is `/mobile`.

---

## iPhone Safari

> Safari on iPhone is required. Chrome and other browsers on iOS cannot install PWAs.

1. Open **Safari** and navigate to `https://<sale-day-ip>/mobile`.
2. Wait for the page to fully load (the scan screen or login screen should appear).
3. Tap the **Share** button (box with an upward arrow) at the bottom of the screen.
4. Scroll down in the share sheet and tap **Add to Home Screen**.
5. Edit the name if desired (e.g., "Plant Sales") and tap **Add** in the top-right corner.
6. The app icon appears on your home screen. Tap it to launch — it opens full-screen without Safari's browser chrome.

### Troubleshooting (iPhone)

- **"Add to Home Screen" is missing:** You are not in Safari. Switch to Safari.
- **Camera doesn't work after install:** The HTTPS certificate is not trusted. See [HTTPS & LAN Deployment](./01-https-lan-deployment.md).
- **App shows a blank screen:** The server may be unreachable. Confirm you are on the sale day Wi-Fi network.

---

## Android Chrome

> Chrome on Android is the recommended browser. Other Chromium-based browsers (Edge, Brave) also work.

1. Open **Chrome** and navigate to `https://<sale-day-ip>/mobile`.
2. Wait for the page to fully load.
3. Chrome may automatically show an **"Add to Home screen"** banner at the bottom of the screen — tap it.
4. If the banner does not appear, tap the **three-dot menu** (⋮) in the top-right corner, then tap **Add to Home screen** (or **Install app** on newer Chrome versions).
5. Confirm by tapping **Add** in the dialog.
6. The app icon appears in your app drawer and/or home screen. Tap it to launch in standalone mode.

### Troubleshooting (Android)

- **"Add to Home screen" option is missing:** The site may not have loaded over HTTPS, or the `manifest.webmanifest` failed to load. Confirm HTTPS is working (padlock in address bar).
- **Camera permission denied:** Go to Chrome Settings → Site Settings → Camera → find `https://<sale-day-ip>` and set to "Allow".
- **App crashes on launch:** Clear Chrome cache for the site and reinstall.

---

## Confirming the Install Worked

After installation on either platform:

1. Launch the app from the home screen icon.
2. The URL bar should be hidden — the app runs in standalone/fullscreen mode.
3. Navigate to `/mobile` (the app should open there directly).
4. Tap the scan button and confirm the camera permission dialog appears.

If any step fails, refer to [Device Readiness Checklist](./03-device-readiness-checklist.md) for the full pre-sale verification process.
