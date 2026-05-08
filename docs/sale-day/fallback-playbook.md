---
title: Sale-Day Fallback Playbook
audience: sale-day supervisor / volunteer
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Fallback Playbook

When something breaks during the sale, find the matching section below and
follow the **First / Next / Escalate** ladder. **Do not freelance.**
Volunteers should escalate to the supervisor; the supervisor escalates to
ops.

## Conventions

- **Volunteer action:** what the person at the station does immediately.
- **Supervisor action:** what the floating supervisor does in parallel.
- **Escalate when:** what triggers a stop-the-sale call to ops / the user.

---

## 1. Scanner won't open the camera

### Symptoms

- Tapping **Start scanner** shows a permission denial, OR the viewport
  stays black, OR the status pill stays at `permission-denied` /
  `error`.

### Volunteer action

- **First:** Confirm the URL bar is not visible (= PWA was launched from
  the home-screen icon, not the browser). If you see the address bar,
  close and re-launch from the home-screen icon.
- **Next:** Open the device Settings -> Safari (iOS) or Site settings
  (Android Chrome) and confirm the Hawk Plants origin has Camera =
  **Allow**. Toggle to Allow and reload `/mobile/pickup`.
- **Escalate:** If still failing after one toggle, **switch to manual
  entry** for this station and call the supervisor.

### Supervisor action

- Hand the volunteer a spare phone with the camera permission already
  granted. Move the broken phone to the manual-entry pool.

### Escalate to ops when

- More than **two phones** show the same camera failure -- this is a
  signal of an HTTPS / secure-context regression. Stop the sale until
  ops confirms HTTPS is healthy.

---

## 2. Backend returns 5xx (or the page just spins)

### Symptoms

- Any action -- login, lookup, scan -- shows the connection-required
  scene or a "Could not reach the server" toast.
- Multiple stations report the same problem within ~60 seconds.

### Volunteer action

- **First:** Refresh the page once. If the connection-required scene
  appears immediately, that is the app correctly detecting a backend
  outage, not a client bug.
- **Next:** Switch to the **paper backup** (see
  `print-and-paper-backup.md`). Continue serving customers; record
  fulfillment by hand on the printed order list.
- **Escalate:** Tell the supervisor immediately.

### Supervisor action

- Walk to the laptop running the API. Check the API process is alive.
- Run `curl https://localhost:5001/api/health` from the laptop.
- If the API is down: restart the process (or the laptop) per the
  ops runbook, then announce "API back" on the volunteer radio.
- If Postgres is down: same procedure, but Postgres first.

### Escalate to ops when

- The API does not return 200 within 5 minutes of restart.
- The laptop will not boot or the database is corrupt.

---

## 3. Sale gets marked closed mid-day

### Symptoms

- Volunteer suddenly sees a "Sale is closed" banner or the
  scan endpoint returns 409 with a sale-closed message.
- This was not announced.

### Volunteer action

- **First:** **Stop scanning.** Do not try to "force" anything.
- **Next:** Tell the customer there is a brief pause and call the
  supervisor.
- **Escalate:** Always.

### Supervisor action

- Open the admin web page on the laptop.
- Settings -> SaleClosed toggle. Confirm whether it is intentionally on
  (e.g., end-of-day winddown) or accidentally on.
- If accidental, toggle it off. Announce "Sale is open" on the radio.
- If intentional, instruct volunteers to switch to paper backup for the
  remaining customers (see `print-and-paper-backup.md`).

### Escalate to ops when

- Toggling SaleClosed off has no effect (volunteers still see the
  banner). This indicates a stale cache or a deeper bug.

---

## 4. Volunteer's phone dies

### Symptoms

- Phone is at 0%, will not power on, or is physically broken.

### Volunteer action

- **First:** Step away from the station with your phone.
- **Next:** Plug into the charging brick at the supervisor table. Wait
  for at least 10% before retrying.
- **Escalate:** Always tell the supervisor; they will swap in a spare.

### Supervisor action

- Hand the volunteer a **spare phone** that has already been
  pre-installed (PWA, signed in, or at least with the URL on the home
  screen).
- Sign in with the volunteer's existing account (so the audit log
  remains attributed correctly).
- The dead phone goes to the charging table; do not reuse it until it
  has reached 50%.

### Escalate to ops when

- All spare phones are dead at the same time. This is a power / charging
  failure -- check the charging brick.

---

## 5. User forgot login

### Symptoms

- Volunteer types a password and gets "Invalid credentials" three times.

### Volunteer action

- **First:** Confirm caps lock and that you are using the **on-screen**
  keyboard correctly (no autocorrect inserted spaces).
- **Next:** Tell the supervisor.
- **Escalate:** Always.

### Supervisor action

- Open the admin user-management surface on the laptop.
- Locate the volunteer's account.
- Reset the password. Hand the new password to the volunteer in person
  on a slip of paper (do not text or message it).
- Cross-reference: see `accounts-and-roles.md` -> "Password and lockout
  recovery".

### Escalate to ops when

- Password reset on the laptop does not propagate to the phone within
  60 seconds (volunteer still sees Invalid credentials with the new
  password). This indicates an auth backend cache or token issue.

---

## 6. Barcode label is damaged

### Symptoms

- Camera will not decode the label after 10+ seconds.
- Label is visibly torn, smudged, or rain-soaked.

### Volunteer action

- **First:** Hold the label flat under good light at ~6 inches from the
  camera. Try once more.
- **Next:** Tap **Manual entry** and type the order number from the
  printed text near the barcode.
- **Escalate:** If the printed text is also unreadable, call the
  supervisor.

### Supervisor action

- Use the printed order list (paper backup) to identify the order by
  customer name.
- Hand the volunteer the order number on paper.
- Volunteer fulfills via manual entry.

### Escalate to ops when

- More than **5 labels** are damaged -- this is a printing / handling
  systemic issue, not a one-off, and warrants a re-print.

---

## 7. PWA launches but is "stuck" (visual freeze)

### Symptoms

- Tapping does nothing; viewport is frozen on a previous state.

### Volunteer action

- **First:** Force-close the PWA from the app switcher and re-launch
  from the home-screen icon.
- **Next:** If still frozen, sign out from the drawer (if reachable) and
  sign back in.
- **Escalate:** If sign-out is not reachable, call the supervisor.

### Supervisor action

- On the volunteer's phone, in Safari/Chrome settings, **clear site data**
  for the Hawk Plants origin, then re-launch.
- Check `audit-guide.md` to confirm no fulfillments are missing.

### Escalate to ops when

- Multiple phones freeze in the same place at the same time -- file a
  hardening regression and stop using that workflow until ops triages.

---

## Cross-references

- "Wrong role" / "Access denied" scene -> see `accounts-and-roles.md`.
- "Wi-Fi drops / backend unreachable" -> see `deployment.md` (HTTPS / LAN
  section).
- Paper-backup mechanics -> see `print-and-paper-backup.md`.
- Audit / "did this scan really land" -> see `audit-guide.md`.
