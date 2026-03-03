import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetAdmin() {
  return (
    <PrintLayout backTo="/settings">
      <h1 className="text-2xl font-bold text-center mb-1">Hampton Hawks Plant Sales</h1>
      <h2 className="text-lg font-semibold text-center text-gray-600 mb-6">
        Admin Quick Reference
      </h2>

      <div className="space-y-5 text-sm">
        <Section title="SaleClosed Toggle">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to <strong>Settings</strong> in the navigation bar.</li>
            <li>Find the <strong>Sale Closed</strong> toggle switch.</li>
            <li>When enabled, a red &quot;SALE CLOSED&quot; banner appears site-wide and scanning is disabled.</li>
            <li>Toggle it off to re-open the sale and allow scanning.</li>
            <li>Requires admin PIN to change.</li>
          </ul>
        </Section>

        <Section title="Force Complete an Order">
          <ul className="list-disc ml-5 space-y-1">
            <li>Open the order detail page.</li>
            <li>In the <strong>Admin Actions</strong> section, click <strong>Force Complete</strong>.</li>
            <li>Enter your admin PIN and a reason (e.g., &quot;Customer took partial order&quot;).</li>
            <li>The order status changes to Complete regardless of fulfillment progress.</li>
          </ul>
        </Section>

        <Section title="Edit Barcode / SKU">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to <strong>Plants</strong> and find the plant.</li>
            <li>Click the plant to open its detail page.</li>
            <li>Edit the <strong>SKU / Barcode</strong> field and save.</li>
            <li>Future scans will use the updated barcode value.</li>
          </ul>
        </Section>

        <Section title="Adjust Inventory">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to the <strong>Inventory</strong> page.</li>
            <li>Find the plant and click to edit.</li>
            <li>Adjust the <strong>quantity on hand</strong> value.</li>
            <li>Save changes. The new count takes effect immediately.</li>
          </ul>
        </Section>

        <Section title="Reset an Order">
          <ul className="list-disc ml-5 space-y-1">
            <li>Open the order detail page.</li>
            <li>In the <strong>Admin Actions</strong> section, click <strong>Reset Order</strong>.</li>
            <li>Enter your admin PIN and a reason.</li>
            <li>All fulfillment progress is cleared and the order returns to Open status.</li>
            <li>Use this if an order was fulfilled incorrectly and needs to start over.</li>
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
