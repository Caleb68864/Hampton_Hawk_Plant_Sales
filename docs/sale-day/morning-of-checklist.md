---
title: Morning-Of Sale Checklist (30-60 minutes)
audience: sale-day supervisor
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Morning-Of Sale Checklist

Run this 30-60 minutes before the doors open. Anything below that fails
is escalated to the supervisor (you) for immediate action.

## Devices

- [ ] All volunteer phones charged to >= 80%.
- [ ] Charging brick plugged in at the supervisor table; spare cables
      laid out.
- [ ] At least one spare phone, charged, with the PWA installed and the
      home-screen icon ready.
- [ ] Battery pack(s) topped up.

## Network

- [ ] Sale-day Wi-Fi router is up.
- [ ] Laptop / NUC running the API is plugged in (Ethernet to router).
- [ ] `<sale-day-endpoint TBD>/api/health` returns 200 from the laptop.
- [ ] `<sale-day-endpoint TBD>/api/health` returns 200 from one phone on
      the Wi-Fi.
- [ ] HTTPS lock icon is visible in the address bar of one phone (no
      "Not Secure" warning).

## Camera permissions

- [ ] Each pickup-station phone has Camera = Allow for the Hawk Plants
      origin (Settings -> Safari / Site settings).
- [ ] On each phone, open `/mobile` from the home-screen icon, sign in,
      and confirm standalone mode (no address bar).

## Volunteer logins

- [ ] Each volunteer signs in once with their assigned account.
- [ ] Drawer shows the expected workflows for each role:
  - `pickup-N` -> Pickup + Lookup.
  - `lookup-N` -> Lookup only.
  - `admin-*` -> all of the above.
- [ ] No volunteer is signed in on a phone that is not theirs.

## Backend reachability drill

- [ ] One pickup volunteer opens `/mobile/pickup` and confirms the
      camera viewport renders with status "Searching...".
- [ ] One lookup volunteer opens `/mobile/lookup` and confirms the
      input is focusable and the empty-state seed illustration shows.

## Fixture scans (3 of 5)

- [ ] Fixture 1 (`HHPS-TEST-0001`) -- exact-match lookup -> pickup-scan
      navigation -> camera scan one line. (See `fixtures.md`.)
- [ ] Fixture 2 (`HHPS-TEST-0002`) -- partially-fulfilled order opens
      cleanly with already-fulfilled lines stamped.
- [ ] Fixture 5 (`HHPS-TEST-0005`) -- not-found order shows the
      empty-state, no spinner-stuck state.

## Offline drill

- [ ] On one phone, toggle airplane mode ON. The connection-required
      scene appears within 2 seconds.
- [ ] Toggle airplane mode OFF. The page recovers without a hard
      refresh.

## PWA install

- [ ] Every phone in use has the home-screen icon.
- [ ] Tapping the icon launches in standalone mode (no address bar).

## Paper backup ready

- [ ] Outstanding-orders printout (two copies) is on the supervisor
      table.
- [ ] Manual fulfillment log sheet + three pens are ready.
- [ ] Supervisor knows the reconciliation procedure (see
      `print-and-paper-backup.md`).

## Sale-day-only changes

- [ ] Note any decisions made this morning that volunteers must know
      (e.g., "Lookup is at table 3 today, not table 1"). Communicate
      these on the volunteer radio before doors open.

## Final go / no-go

- [ ] All boxes above are checked.
- [ ] No `[REGRESSION]` items from `hardening-checklist.md` blocking
      sale day.
- [ ] Supervisor announces "We are open."

If any item above is **No**, do not open the sale until it is resolved
or a documented fallback is in place (`fallback-playbook.md`).
