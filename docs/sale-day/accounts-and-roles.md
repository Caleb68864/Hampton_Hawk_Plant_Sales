---
title: Accounts And Roles On Sale Day
audience: sale-day supervisor / admin
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-01-user-authentication-and-roles-design.md
  - docs/plans/2026-05-05-05-mobile-order-lookup-workflow-design.md
---

# Accounts And Roles On Sale Day

What login each volunteer needs, what they can do, what they cannot do, and
how to recover if a volunteer gets locked out.

## Roles

The five roles defined in `api/src/HamptonHawksPlantSales.Core/Enums/AppRole.cs`
are:

| Role | Purpose |
|------|---------|
| `Admin` | Full access -- everything below, plus admin-only actions, force-complete, password resets, and the scanner demo route. |
| `Pickup` | Sale-day fulfillment volunteer. Pickup workflow + Lookup workflow. |
| `LookupPrint` | Sale-day order-lookup volunteer. Lookup workflow only (no pickup, no scan-fulfill). |
| `POS` | Point-of-sale / walk-up. Web kiosk only -- not part of the mobile sale-day shell. |
| `Reports` | Read-only reporting access. Not used during the sale itself. |

Mobile workflow gating is enforced in `web/src/routes/mobileRouteConfig.ts`:

- **Pickup workflow** requires role `Pickup` or `Admin`.
- **Lookup workflow** requires role `LookupPrint`, `Pickup`, or `Admin`.
- **Scanner demo** requires role `Admin` (and is currently `enabled: false`
  in the route config -- it does not appear in the drawer for any volunteer).

## What each role can do on mobile

| Action | Admin | Pickup | LookupPrint | POS | Reports |
|--------|:-----:|:------:|:-----------:|:---:|:-------:|
| Sign in to `/mobile` | yes | yes | yes | no\* | no\* |
| See the mobile drawer | yes | yes | yes | -- | -- |
| Open Pickup workflow | yes | yes | no (access denied) | -- | -- |
| Scan a barcode -> fulfill | yes | yes | no | -- | -- |
| Open Lookup workflow | yes | yes | yes | -- | -- |
| Search by order number | yes | yes | yes | -- | -- |
| Search by customer name | yes | yes | yes | -- | -- |
| See exact-match navigate | yes | yes | yes | -- | -- |
| Force-complete an order | yes | no | no | -- | -- |
| Resend / reset password | yes | no | no | -- | -- |

\* `POS` and `Reports` users will sign in successfully but
`hasMobileAccess()` returns false and they are routed to the access-denied
scene at `/mobile`. They are not "rejected" -- they are just shown a
"Mobile workflows are not available for your role" message.

## What each role MUST NOT do on mobile

These are sale-day "trust" guarantees -- if any of these fails, file a
backlog issue and treat it as a P0.

- A `LookupPrint` user must not be able to fulfill (POST to a
  `/scan` endpoint succeeds with the wrong role -> file P0). Lookup is
  read-only and can navigate to scan, but the scan endpoint backend gates by
  role.
- A `Pickup` user must not be able to force-complete an order without an
  Admin PIN.
- A volunteer of any role must not be able to see another volunteer's audit
  trail through the mobile UI.
- No role should be able to print, export, or download customer PII from
  `/mobile/*`.

## Account creation

Accounts are created in the user-management surface (web admin). The
exact UI surface is owned by the auth plan; until the admin route is
finalized, treat this as: "Admin signs into the web app at the laptop and
opens the Users page, creates one account per volunteer, assigns the
minimum required role, sets a temporary password."

### Naming convention (recommended)

Use station-based usernames so the audit log stays readable after sale day:

```
pickup-1     pickup-2     pickup-3
lookup-1     lookup-2
admin-caleb
```

Avoid using volunteer real names as usernames -- a volunteer might rotate
out mid-sale and a different person take their station, and the audit log
should reflect "station 2 fulfilled this order at 11:42" not "Joe fulfilled
this order at 11:42 (but Maria was at the station at the time)."

### Minimum role

Always assign the **least privileged role** that still lets the volunteer
do their job:

| Volunteer station | Assigned role |
|-------------------|---------------|
| Pickup table (camera scan + manual entry) | `Pickup` |
| Lookup / customer-help table (search only) | `LookupPrint` |
| Floating supervisor (anything) | `Admin` |
| Walk-up cash register | `POS` (web kiosk, not mobile) |

## Password and lockout recovery

If a volunteer is locked out:

1. **Try the obvious first** -- caps lock on virtual keyboard, password typo,
   user typed username instead of email or vice versa.
2. **Reset on the spot from Admin** -- the supervising Admin opens the user
   admin surface on the laptop and resets the password. Hand the new
   password to the volunteer in person; do not text or email it.
3. **Re-login on the phone** -- volunteer signs out (drawer -> Sign out),
   signs back in with the new password.
4. **Audit cross-check** -- if the lockout was due to a wrong-account login
   (someone else's session got onto this phone), check the audit log
   (`audit-guide.md`) to confirm no fulfillments happened under the wrong
   account.

If multiple volunteers are locked out at the same time, that is a likely
signal that the API auth backend is unreachable or returning 5xx -- jump
to `fallback-playbook.md` -> "backend returns 5xx".

## Sale-day account checklist

- [ ] Each pickup station has its own `pickup-N` account, role `Pickup`.
- [ ] Each lookup station has its own `lookup-N` account, role `LookupPrint`.
- [ ] At least one floating supervisor has `Admin`.
- [ ] All temporary passwords are written down (paper, not digital) and held
      by the supervisor.
- [ ] Every volunteer has logged in successfully at least once **before**
      the sale starts.
- [ ] Drawer shows the expected workflows for each role.

## Related

- `device-checklist.md` -- which device each volunteer takes.
- `audit-guide.md` -- how to read who did what during the sale.
- `fallback-playbook.md` -- recovery for "user forgot login".
