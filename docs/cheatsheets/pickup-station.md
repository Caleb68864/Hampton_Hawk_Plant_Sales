# Pickup Station Cheat Sheet

## Before You Start
1. Open the app at **http://localhost:3000**
2. Navigate to **Station Home** from the top navigation
3. Select **Scan Pickups**
4. Make sure your barcode scanner is plugged in and working

## Looking Up an Order
- Type the customer's **name**, **pickup code**, or **order number** in the search box
- Click on the matching result to open the scan screen
- Tip: Use **Ctrl+K** for Quick Find from anywhere

## Scanning
1. The scan input (large green box) should be focused automatically
2. Scan each plant barcode -- the scanner types the code and presses Enter
3. Watch for feedback:
   - **Green highlight + chime** = matched and fulfilled
   - **Amber warning** = over-scan (already fulfilled)
   - **Red error + buzzer** = no match on this order

## Undo a Scan
- Click **Undo Last Scan** to reverse the most recent scan
- This decrements the fulfilled quantity by one

## Completing the Order
- When all lines show 100%, click **Complete**
- If some items are unavailable, click **Force Complete** (requires admin PIN + reason)

## Tips
- If the input loses focus, click on the green scan box or press Tab
- Duplicate scans within 2 seconds are automatically ignored
- Check the scan history list below the order for a full audit trail
