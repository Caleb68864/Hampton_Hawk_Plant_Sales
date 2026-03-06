# UI-01 Print Order Sheet Barcode

## Goal
Verify that printed order sheets show a real scanner-readable barcode for the order number near the top of the page.

## Steps
1. Open any order sheet at `/print/order/:orderId`.
2. Confirm the header still shows the human-readable order number.
3. Confirm a barcode block labeled **Scan for pickup** appears near the top header area.
4. Open print preview.
5. Confirm the barcode stays visible, centered, and does not overlap the customer, seller, or pickup code fields.
6. Print the page using the normal station printer settings.
7. Scan the printed barcode into a plain text field.

## Expected Results
- The order sheet shows both the human-readable order number and a barcode encoding the same value.
- The barcode remains readable in print preview and on paper.
- The scanner outputs the expected order number string.
