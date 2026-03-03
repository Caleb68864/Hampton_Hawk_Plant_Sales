import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetLookup() {
  return (
    <PrintLayout backTo="/station">
      <h1 className="text-2xl font-bold text-center mb-1">Hampton Hawks Plant Sales</h1>
      <h2 className="text-lg font-semibold text-center text-gray-600 mb-6">
        Lookup Station Quick Reference
      </h2>

      <div className="space-y-5 text-sm">
        <Section title="A-Z Tabs">
          <ul className="list-disc ml-5 space-y-1">
            <li>Start at <strong>Station Home</strong> and choose <strong>Lookup &amp; Print</strong>.</li>
            <li>The Pickup Lookup page shows <strong>A-Z letter tabs</strong> across the top.</li>
            <li>Click a letter to filter customers whose last name starts with that letter.</li>
            <li>Click <strong>All</strong> to show all customers.</li>
            <li>Each tab shows the number of matching orders in a badge.</li>
          </ul>
        </Section>

        <Section title="Keyboard Hotkeys">
          <ul className="list-disc ml-5 space-y-1">
            <li>Press any <strong>letter key (A-Z)</strong> to jump to that tab instantly.</li>
            <li>Press <strong>Escape</strong> to clear the current filter and return to All.</li>
            <li>Use <strong>Arrow Down / Arrow Up</strong> to navigate the list.</li>
            <li>Press <strong>Enter</strong> to open the selected order.</li>
          </ul>
        </Section>

        <Section title="Quick Find (Ctrl+K)">
          <ul className="list-disc ml-5 space-y-1">
            <li>Press <strong>Ctrl+K</strong> from anywhere to open the Quick Find overlay.</li>
            <li>Type a customer name, order number, or pickup code.</li>
            <li>Results appear instantly as you type.</li>
            <li>Click a result or press Enter to navigate directly to it.</li>
          </ul>
        </Section>

        <Section title="Printing an Order">
          <ul className="list-disc ml-5 space-y-1">
            <li>Open the order detail page by clicking on an order.</li>
            <li>Click the <strong>Print Order</strong> button in the Actions section.</li>
            <li>A print-friendly page opens in a new tab.</li>
            <li>Click <strong>Print</strong> or use <strong>Ctrl+P</strong> to send to the printer.</li>
          </ul>
        </Section>

        <Section title="Printing a Seller Packet">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to the <strong>Sellers</strong> page and select a seller.</li>
            <li>Click <strong>Print Seller Packet</strong> to open the packet view.</li>
            <li>Use the toggle controls to include or exclude pre-orders, walk-ups, and completed orders.</li>
            <li>Each customer gets their own page for easy separation.</li>
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
