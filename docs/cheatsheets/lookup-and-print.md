# Lookup and Print Cheat Sheet

## Finding an Order
1. Go to **Station Home** in the top navigation
2. Select **Lookup & Print**
3. Open **Orders** from the top navigation for full filtering and reporting tools
4. Use the search bar to find by order number, customer name, or seller name
5. Use the **status filter** dropdown to show only Open, InProgress, Complete, or Cancelled orders
6. Use **A-Z tabs** to jump to customers by last name initial

## Viewing Order Details
- Click any order row to see full details
- The detail page shows: customer info, seller, order lines with fulfillment progress, and event history

## Printing an Order Sheet
1. From the order detail page, click **Print Order Sheet**
2. This opens a print-friendly page at `/print/order/:orderId`
3. Click the green **Print** button or use Ctrl+P

## Printing a Seller Packet
1. Go to **Sellers** in the sidebar
2. Find the seller and open their detail page
3. Click **Print Seller Packet**
4. This prints a summary of all orders attributed to that seller

## Printing Plant Labels
1. From a plant detail page, click **Print Label** for a single-item test print.
2. From the **Imports** page after a plant import, click **Print Labels** to open a batch run.
3. On `/print/labels`, choose density:
   - **1-up Test** (single label for alignment)
   - **Full Sheet (30)** for sticker sheets
   - **Full Roll (80)** for thermal roll stock
4. Use 100% scale, disable browser "Fit to page", and run a 1-up test before full batches.

### Tested Printer Models / Settings
- **DYMO LabelWriter 450 Turbo**
  - Media: 1" x 2-1/8" address labels
  - Scale: 100%
  - Margins: None / 0
  - Browser print setting: background graphics off (faster), header/footer off
- **Rollo USB Thermal Printer (X1038)**
  - Custom size: 1.00" x 2.00"
  - Darkness: 8
  - Speed: 4 ips
  - Print orientation: portrait
- **HP LaserJet Pro (Avery 5160 compatible sheet labels)**
  - Paper: US Letter label sheet
  - Scale: 100% (never "Fit")
  - Feed: tray with label sheet support enabled

## Finding Customers
1. Go to **Customers** in the sidebar
2. Search by name, email, or pickup code
3. Click a customer to see their details and linked orders

## Quick Tips
- **Ctrl+K** opens Quick Find to search across customers, orders, and sellers at once
- Use **/** on list pages to jump to the search bar
- Press a **letter key (A-Z)** to activate the corresponding tab filter
