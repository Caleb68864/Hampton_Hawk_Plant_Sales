# UI-03 Kiosk Print Return

## Goal
Verify that printing from kiosk workflows preserves the original station context.

## Steps
1. Enable **Lookup & Print** kiosk mode.
2. Search for an order that has a seller packet option.
3. Click **Print Order Sheet**.
4. Confirm the print view opens in a new tab.
5. Close the print tab and confirm the original `/lookup-print` tab is unchanged.
6. Re-open **Print Order Sheet** and click the print page's **Back** link.
7. Confirm the print page returns to `/lookup-print`.
8. Click **Print Seller Packet**.
9. Confirm the print view opens in a new tab and the original station tab stays on `/lookup-print`.
10. Switch to **Pickup** kiosk mode, open any order, and click **Print Order Sheet**.
11. Confirm the print page's **Back** link returns to `/pickup/:orderId`.

## Expected Results
- Print views open in new tabs.
- Closing or backing out of print keeps volunteers anchored in their assigned station workflow.
- No print flow exposes the full app shell before returning.
