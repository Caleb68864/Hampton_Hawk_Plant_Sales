# Device Readiness Checklist

Complete this checklist on **every device** that will be used on sale day, at least 30 minutes before doors open.

---

## Pre-Sale Checklist

- [ ] **Wi-Fi connected** — Device is connected to the sale day Wi-Fi network (not mobile data). Confirm by visiting `https://<sale-day-ip>/mobile` in the browser and seeing the login or scan screen.
- [ ] **Camera permission granted** — Open the installed app and tap the scan button. The camera preview should appear. If prompted, tap "Allow". If the camera never appears, check Settings → Privacy → Camera and ensure the browser/app is listed and enabled.
- [ ] **Screen brightness set to maximum (or near-maximum)** — High brightness improves barcode scan accuracy in varied lighting. Set to at least 80%.
- [ ] **Auto-lock / screen timeout disabled or extended** — Set screen auto-lock to "Never" or at least 5 minutes so the screen does not turn off mid-transaction. iOS: Settings → Display & Brightness → Auto-Lock. Android: Settings → Display → Screen Timeout.
- [ ] **PWA installed and launches from home screen** — The app icon is on the home screen. Tap it and confirm it opens in full-screen mode (no browser address bar). See [PWA Install Guide](./02-pwa-install-guide.md) if not installed.
- [ ] **Battery at 80% or higher, or device is charging** — Plug in any device that is below 80%. Have a charging cable and power bank available at each station.
- [ ] **Account login confirmed** — Log in to the app with the assigned volunteer account (see [Account & Role Setup](./04-account-role-setup.md)). Confirm the correct role screen appears (e.g., POS screen for POS roles, Pickup screen for Pickup roles).
- [ ] **HTTPS certificate trusted** — The browser shows a padlock icon (not a warning) when accessing `https://<sale-day-ip>`. If a certificate warning appears, follow the trust steps in [HTTPS & LAN Deployment](./01-https-lan-deployment.md).
- [ ] **No pending OS updates** — Dismiss or defer any OS update prompts. Updates mid-sale can restart the device or change camera/permission behavior.
- [ ] **Do Not Disturb / Focus mode enabled** — Enable DND to suppress incoming call overlays and notification banners during transactions.

---

## Station-Specific Notes

| Station | Device Type | Assigned Account | Notes |
|---------|-------------|-----------------|-------|
| POS 1 | Laptop/Tablet | POS supervisor | Primary cash/card terminal |
| POS 2 | Phone/Tablet | POS2 | Mobile scan + payment assist |
| POS 3 | Phone/Tablet | POS3 | Mobile scan + payment assist |
| Pickup 1 | Phone/Tablet | Pickup1 | Order fulfillment scanning |
| Pickup 2 | Phone/Tablet | Pickup2 | Order fulfillment scanning |

---

## If Something Fails

- Camera blocked → re-check certificate trust and browser camera permission.
- App shows blank screen → confirm Wi-Fi is connected and the sale day server is running.
- Login fails → see [Account & Role Setup](./04-account-role-setup.md) for credentials and role assignments.
- PWA not installed → follow [PWA Install Guide](./02-pwa-install-guide.md).
