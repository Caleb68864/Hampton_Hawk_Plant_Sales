---
title: Sale-Day Device Checklist
audience: sale-day supervisor / volunteer
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-02-mobile-joy-shell-and-pwa-design.md
  - docs/plans/2026-05-05-03-camera-scanner-foundation-design.md
---

# Sale-Day Device Checklist

What hardware you need, what software each device needs, and what to test
**before** sale-day morning. Every volunteer using the camera scanner needs
to walk through this once on the phone they will actually carry.

## Hardware bag

- [ ] At least one phone or tablet **per pickup volunteer** (1 station = 1 device).
- [ ] At least one **spare** phone, charged.
- [ ] Charging brick (3+ USB-C / Lightning ports).
- [ ] Two charging cables per device type in use.
- [ ] At least one battery pack (10000 mAh or larger).
- [ ] Wi-Fi router for the sale-day LAN, plus its power cable.
- [ ] Laptop / NUC running the API + Postgres, plus its power cable.
- [ ] Wired Ethernet cable for the laptop -> router (Wi-Fi for the laptop is
      a fallback, not a plan).
- [ ] Printer (for paper backup -- see `print-and-paper-backup.md`).
- [ ] Pen + clipboard for paper-backup recording.
- [ ] Spare paper.

## Browser version requirements

The camera scanner uses ZXing via `getUserMedia`. The minimum supported
browsers (per `docs/scanner/browser-support.md`) are:

| Browser | Minimum | Notes |
|---------|---------|-------|
| iOS Safari | 16.4+ | Older iOS does not support `BarcodeDetector` fallback paths reliably |
| Android Chrome | 110+ | Older Chrome has flaky autofocus |
| Android Firefox | not supported | Falls back to manual entry |
| Desktop Chrome (test only) | 110+ | For supervisor previews |

If a volunteer brought an older device, route them to **manual entry only**
and pair them with a scanner-capable volunteer.

## Per-device readiness

Run through this list **once per phone**, ideally the day before.

### Connectivity

- [ ] Phone is on the sale-day Wi-Fi (not cellular -- the API is LAN-only).
- [ ] Open `<sale-day-endpoint TBD>/mobile` in the browser and confirm the
      login page renders.
- [ ] Confirm HTTPS (lock icon in the address bar). If self-signed, accept
      the trust prompt now so you do not see it again on sale day.

### PWA install

- [ ] Follow `install-pwa.md` to add Hawk Plants to the home screen.
- [ ] Launch from the home-screen icon and confirm standalone display
      (no address bar).

### Camera permission

- [ ] Sign in as a volunteer user.
- [ ] Open `/mobile/scanner-demo` (visible only if your role includes Admin;
      otherwise the supervisor does this from a phone with Admin and hands
      over).
- [ ] Tap **Start scanner**.
- [ ] When iOS / Android prompts for camera access, tap **Allow**.
- [ ] Confirm the camera viewport renders (corner reticle visible) and the
      status pill says **Searching...**

### Display & power settings

- [ ] **Brightness:** at least 70%. Auto-brightness is acceptable indoors
      but bump it up if the sale is outdoors.
- [ ] **Auto-lock / screen timeout:** raise to **5 minutes** minimum. Android
      Settings -> Display -> Screen timeout. iOS Settings -> Display & Brightness
      -> Auto-Lock. The default 30 seconds will frustrate volunteers between
      customers.
- [ ] **Battery saver:** **off**. Battery saver throttles the camera frame
      rate and can stall ZXing decoding.
- [ ] **Charge level:** at least 80% before the sale starts. Plug into the
      charging brick whenever idle.

### Account login

- [ ] Volunteer signs in with their assigned account (see
      `accounts-and-roles.md`).
- [ ] After login, the mobile drawer shows the workflows their role allows
      (Pickup, Lookup, etc).
- [ ] Sign out from the drawer, sign back in, confirm there is no stale
      state. (This is the one moment to find a "logged in as the wrong
      person" bug.)

## Pre-sale-day drill (T-1)

Run this drill end to end on at least one phone:

1. **Login as Pickup volunteer.**
2. **Open Pickup -> scan a fixture barcode** (see `fixtures.md`).
3. **Open Lookup -> search a fixture order number**, confirm the order details
   load.
4. **Toggle airplane mode ON** while the app is open.
5. Try to scan or look up an order. The connection-required scene should
   appear.
6. **Toggle airplane mode OFF.**
7. Wait ~3 seconds for Wi-Fi to reattach.
8. Repeat the scan / lookup. The app should recover without a manual
   refresh. (If a refresh is required, that is acceptable behavior but worth
   noting in `hardening-checklist.md`.)
9. **Lock the phone for 30 seconds** during a scan session. Unlock and
   confirm the camera does **not** stay live in the background and the
   scanner cleanly resumes when the page is foregrounded.

## On sale-day morning

Use `morning-of-checklist.md`, which is the short version of the above.

## Related

- `install-pwa.md` -- add to home screen instructions.
- `accounts-and-roles.md` -- which login each volunteer gets.
- `morning-of-checklist.md` -- short version, day-of.
- `fixtures.md` -- test data for the drill.
