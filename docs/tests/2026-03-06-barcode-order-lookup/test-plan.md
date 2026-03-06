# Barcode Order Lookup Manual Verification Plan

## Setup
1. Start the project and open the web app.
2. Use a USB keyboard-wedge barcode scanner configured for normal text entry.
3. Print at least one order sheet from `/print/order/:orderId`.
4. If possible, keep a second printed sheet with an invalid or old order number for no-match recovery.

## Scenarios
- [UI-01-print-order-sheet-barcode.md](./UI-01-print-order-sheet-barcode.md)
- [UI-02-pickup-order-barcode-lookup.md](./UI-02-pickup-order-barcode-lookup.md)
- [UI-03-pickup-order-barcode-recovery.md](./UI-03-pickup-order-barcode-recovery.md)

## Coverage Map
- Printed order sheet includes a scanner-readable order barcode: UI-01
- Exact barcode scan opens the matching pickup order: UI-02
- Search box stays scanner-ready for repeated use: UI-02 and UI-03
- No-match feedback and clear-to-rescan workflow: UI-03
- Duplicate order-number handling if data collisions exist: UI-03

## Notes
- Test with the actual printer scaling the event team will use; barcode size matters.
- The pickup lookup page should use the existing search field, not a separate hidden scanner input.
