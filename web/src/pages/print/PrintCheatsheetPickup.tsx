import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetPickup() {
  return (
    <PrintLayout backTo="/pickup">
      <h1 className="text-2xl font-bold text-center mb-1">Hampton Hawks Plant Sales</h1>
      <h2 className="text-lg font-semibold text-center text-gray-600 mb-6">
        Pickup Station Quick Reference
      </h2>

      <div className="space-y-5 text-sm">
        <Section title="How to Find an Order">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to the <strong>Pickup</strong> tab in the navigation bar.</li>
            <li>Type the customer name or pickup code in the search bar.</li>
            <li>Click on the matching order to open it.</li>
            <li>You can also use <strong>Ctrl+K</strong> to open Quick Find from any screen.</li>
          </ul>
        </Section>

        <Section title="How to Scan">
          <ul className="list-disc ml-5 space-y-1">
            <li>With an order open, place your cursor in the <strong>Scan</strong> input field.</li>
            <li>Scan the barcode on the plant tag with the barcode scanner.</li>
            <li>The system will automatically match the scanned SKU to a line item.</li>
            <li>Each scan fulfills one unit of that plant.</li>
          </ul>
        </Section>

        <Section title="Colors and Sounds">
          <ul className="list-disc ml-5 space-y-1">
            <li><strong>Green flash + success chime</strong> -- Item scanned and fulfilled successfully.</li>
            <li><strong>Yellow flash + warning tone</strong> -- Item already fully fulfilled (duplicate scan).</li>
            <li><strong>Red flash + error buzz</strong> -- Item not found on this order (wrong order or unknown SKU).</li>
            <li><strong>Blue highlight</strong> -- Item partially fulfilled, more scans needed.</li>
          </ul>
        </Section>

        <Section title="WrongOrder Warning">
          <ul className="list-disc ml-5 space-y-1">
            <li>If you scan a plant that does not belong to the current order, you will see a <strong>red &quot;Wrong Order&quot;</strong> banner.</li>
            <li>Double-check you have the correct order open.</li>
            <li>If the customer brought the wrong plant, set it aside and continue with the correct items.</li>
          </ul>
        </Section>

        <Section title="Undo a Scan">
          <ul className="list-disc ml-5 space-y-1">
            <li>In the scan history list below the scan input, find the scan you want to undo.</li>
            <li>Click the <strong>Undo</strong> button next to that scan entry.</li>
            <li>The fulfilled quantity will be decremented by one.</li>
          </ul>
        </Section>

        <Section title="Manual Fulfill">
          <ul className="list-disc ml-5 space-y-1">
            <li>If a barcode is damaged or missing, click the <strong>Manual Fulfill</strong> button.</li>
            <li>Select the plant from the dropdown list of order line items.</li>
            <li>Enter the quantity to fulfill and confirm.</li>
          </ul>
        </Section>

        <Section title="Sale Closed Mode">
          <ul className="list-disc ml-5 space-y-1">
            <li>When the sale is closed, scanning is <strong>disabled</strong> and a red banner appears.</li>
            <li>An admin must re-open the sale from <strong>Settings</strong> to resume scanning.</li>
            <li>Orders can still be viewed and printed while the sale is closed.</li>
          </ul>
        </Section>
      </div>

      <PrintFooter showNotesLines={false} />
    </PrintLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-base border-b border-gray-300 pb-1 mb-2">{title}</h3>
      {children}
    </div>
  );
}
