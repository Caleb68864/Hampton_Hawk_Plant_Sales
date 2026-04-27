# Walk-Up Register Cheat Sheet

The walk-up register is the primary tool for ringing up customers who pay
and leave with their plants in one trip. It replaces the legacy "New
Walk-Up Order" form for everyday sales.

## Starting a Sale

1. From **Station Home**, tap **New Sale (Register)**.
2. The register opens a fresh draft ticket and gives it a number.
3. Optionally tag the ticket to a known customer using the search box. A
   walk-up sale does not require a customer record; leave it blank to ring
   up an anonymous customer.

## Scanning Plants

1. Keep the scan input focused. The register auto-focuses on load.
2. Scan each plant barcode in turn. Each scan adds (or increments) a line
   on the ticket and updates the running total at the bottom of the screen.
3. Watch for feedback:
   - **Green** = scanned, added to the ticket, walk-up inventory available.
   - **Amber** = warning -- duplicate scan, low remaining stock, or other
     advisory. The line still posts.
   - **Red** = blocked. Usually means walk-up inventory is exhausted because
     the remaining quantity is reserved for unfulfilled pre-orders.

## Override Flow

When a scan is blocked or flagged for an override (price exception,
inventory cap, etc.):

1. The register opens an **Override** prompt.
2. Enter the **admin PIN** and a short **reason** (for example,
   "manager approved last unit"). Both are required.
3. The override is logged on the ticket and in the admin actions audit
   trail. Only an admin can clear or reverse it.

## Closing a Sale

1. Once all plants are scanned, tap **Close Sale**.
2. Choose the payment method (cash, card, check, etc.).
3. Confirm the totals on the printed receipt and hand the customer their
   copy. The ticket moves to **Closed** and is no longer editable.

## Cancelling a Sale

1. Tap **Cancel Sale** on an open draft.
2. Enter the **admin PIN** and a **reason** -- cancellation is an admin
   action and is always recorded.
3. Confirm. The ticket is marked cancelled, lines are released back to
   inventory, and the draft cannot be reopened.

## Resuming an Open Ticket

If a sale is interrupted (customer left to grab another plant, kiosk
restarted, etc.):

1. From **Station Home**, tap **Resume Open Tickets**.
2. Pick the draft from the list. Open drafts at this workstation surface
   first.
3. Continue scanning, close, or cancel as normal.

## When to Use the Legacy Form

The legacy **Walk-Up Sales (Legacy)** entry on Station Home is a fallback.
Use it **only** when:

- The register is unavailable (outage, browser issue, scanner down) and a
  station lead approves the fallback.
- A historical correction needs to mirror the legacy data shape.

For all other walk-up sales, use the register. The register enforces
walk-up inventory protection, override logging, and the cash-handling
audit trail consistently.
