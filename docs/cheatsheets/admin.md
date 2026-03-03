# Admin Cheat Sheet

## Admin PIN
The admin PIN is set via the `APP_ADMIN_PIN` environment variable (default: `1234`). You need it for:
- Closing or reopening the sale
- Force-completing orders
- Resetting orders back to Open
- Overriding walk-up inventory limits

## Settings Page
Navigate to **Station Home**, then choose **Admin Tools** (Settings).

### Closing the Sale
1. Click **Close Sale**
2. Enter the admin PIN
3. Provide a reason (e.g., "Fundraiser ended")
4. This blocks new orders, modifications, and imports

### Reopening the Sale
1. Click **Reopen Sale**
2. Enter the admin PIN
3. Provide a reason

## Managing Inventory
- Go to **Inventory** to see current stock levels
- Click a plant row to adjust quantities
- Use the **Adjust** button for relative changes (+5, -3, etc.)
- Use **Set** for absolute values

## Importing Data
1. Go to **Imports**
2. Choose the import type: Plants, Inventory, or Orders
3. Upload a CSV or Excel file
4. Review the batch results -- check for row-level issues
5. Note: Imports are blocked when the sale is closed

## Reports / Dashboard
- The **Dashboard** shows key metrics: total orders, fulfillment progress, low inventory alerts
- **Problem Orders** report shows orders with issues (stalled, over-fulfilled)
- **Low Inventory** shows plants below the threshold

## Walk-Up Orders
- Go to **Walk-Up > New Order** for day-of customers
- The system calculates available inventory (on-hand minus pre-order commitments)
- If a walk-up exceeds available stock, an admin override is required

## Force Complete / Reset
- On the pickup scan page, use **Force Complete** if items are unavailable
- Use **Reset** to clear all fulfillment and start over
- Both require the admin PIN and a reason
