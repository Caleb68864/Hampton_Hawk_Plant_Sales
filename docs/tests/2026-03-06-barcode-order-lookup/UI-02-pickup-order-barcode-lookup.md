# UI-02 Pickup Order Barcode Lookup

## Goal
Verify that scanning a printed order-sheet barcode into the existing pickup search box opens the correct order with no extra clicks.

## Steps
1. Open `/pickup`.
2. Confirm the search field is already focused.
3. Scan a valid printed order-sheet barcode.
4. If your scanner does not append Enter, wait for the short lookup delay.
5. Confirm the app navigates directly to `/pickup/:orderId` for the scanned order.
6. Confirm the resulting order screen shows the same order number that was scanned.
7. Use **Back to Lookup**.
8. Confirm `/pickup` is ready for the next scan without manual refocusing.

## Expected Results
- The existing pickup search field accepts the scanner input.
- One exact order-number match opens automatically.
- Returning to lookup leaves the station ready for the next order sheet.
