---
title: Paper Backup Strategy
audience: sale-day supervisor
last_reviewed: 2026-05-07
related_plans:
  - docs/plans/2026-05-05-06-mobile-sale-day-readiness-and-hardening-design.md
---

# Paper Backup Strategy

The mobile shell is online-only by design (see `deployment.md`). When the
backend is unreachable the app refuses to record fulfillments rather than
queueing them locally. That is the right behavior -- but it means we need
a **non-app** way to keep the sale moving while ops fixes the laptop /
network / API.

This document is the paper-backup plan.

## When to switch to paper

- The fallback playbook says so (see `fallback-playbook.md` -> "Backend
  returns 5xx").
- The supervisor announces "switch to paper" on the volunteer radio.
- A volunteer's phone is dead AND no spare is available.

Do **not** switch to paper just because the camera scanner is misbehaving
on a single phone -- manual entry on the same phone is still the
authoritative path.

## What "paper" means

Three artifacts:

1. **Printable order list** -- one row per outstanding order, sorted by
   customer last name, with order number, line items, and quantities.
2. **Manual fulfillment log** -- a blank lined sheet on the supervisor
   table where volunteers record fulfillments as they happen.
3. **A pen.** Two pens. Three pens.

### Printable order list

`<TBD report path>` -- the print-friendly outstanding-order report has not
yet been finalized. The kiosk-side `web/src/pages` already includes a
print template (see `web/public/templates/`); ops decides whether to add a
"Sale-day backup" preset. Until then:

- Print the existing **outstanding orders** report from the web admin app
  on T-1 (the night before).
- Bring two copies (one for the supervisor, one for the lookup table).
- Tape the supervisor copy to the supervisor table so it cannot wander.

### Manual fulfillment log

Use this template on plain lined paper:

```
Time   | Order #         | Customer        | Volunteer (initials) | Notes
-------+-----------------+-----------------+----------------------+------
10:42  | HHPS-12345      | Bloggs          | VA                   | All lines
10:43  | HHPS-12346      | Tester          | VB                   | 2 of 3 lines, 1 oos
```

One row per fulfillment event. Always record the time. Always record the
volunteer's initials (matched to a station number, not a real name --
see `accounts-and-roles.md`).

## Mid-sale procedure

While the API is down:

1. Customer arrives.
2. Volunteer asks for their name.
3. Volunteer (or supervisor) finds the order on the printed list.
4. Volunteer hands the customer their plants.
5. **Volunteer crosses off the line on the printed list** AND records the
   fulfillment in the manual log.
6. The supervisor periodically takes a phone photo of the manual log so
   the data does not live on a single piece of paper.

## Reconciliation -- after the sale

Once the API is back (during the sale or after):

### Phase 1 -- catch up the audit log

The supervisor (Admin role) opens the admin web app on the laptop and:

1. For each row in the manual log, look up the order.
2. Mark the order **force-complete** with reason `paper-backup-recon`.
3. The system records a `FulfillmentEvent` with source `manual-recon` (or
   the closest available source category) and the original time from the
   paper log in the reason field.

### Phase 2 -- reconcile inventory

`<TBD inventory recon>` -- depending on whether the API was unreachable
because of a network issue (inventory state in the DB is correct) or a
data issue (DB rolled back), the supervisor decides whether to:

- Trust the DB inventory and just close out, OR
- Run an inventory adjustment for any plant that was given out during the
  paper window.

This is a **judgment call** by the supervisor in coordination with the
sale's plant lead.

### Phase 3 -- post-sale audit

After sale day, the supervisor uses the audit guide (`audit-guide.md`) to
confirm:

- Every paper-log row has a matching fulfillment event in the database.
- No double-fulfillments slipped through (paper *and* a late mobile scan).
- Any orders missing from both surfaces are flagged for follow-up with
  the customer.

## What NOT to do

- **Do not** ask volunteers to "queue scans for later" on their phone.
  The app does not support this. They will lose the data.
- **Do not** screenshot the order list and expect the volunteer to read
  it from a screenshot during a network outage -- the screenshot will go
  stale the moment another order is fulfilled.
- **Do not** discard the paper log after the sale. Keep it for at least
  30 days alongside the audit trail.

## Pre-sale-day checklist

- [ ] Outstanding-order report printed (two copies).
- [ ] Manual fulfillment log sheet printed.
- [ ] Three pens on the supervisor table.
- [ ] One supervisor-phone has a charged camera ready to photograph the
      log if the API recovers.
- [ ] Reconciliation procedure (above) is on the supervisor's printed
      cheat sheet.

## Related

- `fallback-playbook.md` -- when to switch to paper.
- `audit-guide.md` -- post-sale reconciliation.
- `deployment.md` -- why we do not queue offline.
