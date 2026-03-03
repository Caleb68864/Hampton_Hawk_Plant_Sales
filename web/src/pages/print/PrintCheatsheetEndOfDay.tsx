import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetEndOfDay() {
  return (
    <PrintLayout backTo="/">
      <h1 className="text-2xl font-bold text-center mb-1">Hampton Hawks Plant Sales</h1>
      <h2 className="text-lg font-semibold text-center text-gray-600 mb-6">
        End-of-Day Checklist
      </h2>

      <div className="space-y-5 text-sm">
        <Section title="1. Review the Dashboard">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to the <strong>Dashboard</strong> (home page).</li>
            <li>Review the summary cards: total orders, fulfilled, remaining, walk-ups.</li>
            <li>Check for any orders still in <strong>InProgress</strong> status.</li>
          </ul>
        </Section>

        <Section title="2. Check Low Inventory">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to <strong>Inventory</strong> and sort by quantity ascending.</li>
            <li>Note any plants with zero or very low stock.</li>
            <li>Decide if restocking is needed for the next day.</li>
          </ul>
        </Section>

        <Section title="3. Resolve Problem Orders">
          <ul className="list-disc ml-5 space-y-1">
            <li>On the <strong>Orders</strong> page, filter by orders with issues (has issue flag).</li>
            <li>Review each problem order and decide on action:</li>
            <li className="ml-4"><strong>Force Complete</strong> if the customer has left with partial items.</li>
            <li className="ml-4"><strong>Reset</strong> if the order needs to be re-done tomorrow.</li>
            <li className="ml-4">Add notes for context on any unresolved issues.</li>
          </ul>
        </Section>

        <Section title="4. Confirm Sale Closed">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to <strong>Settings</strong> and enable the <strong>Sale Closed</strong> toggle.</li>
            <li>This prevents any accidental scanning overnight.</li>
            <li>The red &quot;SALE CLOSED&quot; banner will appear across the site.</li>
          </ul>
        </Section>

        <Section title="5. Print Seller Packets (if needed)">
          <ul className="list-disc ml-5 space-y-1">
            <li>Go to <strong>Sellers</strong> and select each seller who needs a packet.</li>
            <li>Click <strong>Print Seller Packet</strong> on their detail page.</li>
            <li>Include completed orders if you want a full record.</li>
            <li>Print one packet per seller for distribution or filing.</li>
          </ul>
        </Section>

        <Section title="End-of-Day Sign-Off">
          <div className="mt-3 space-y-4">
            <div className="flex items-center gap-3">
              <span className="print-checkbox" />
              <span>Dashboard reviewed, no unexpected issues</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="print-checkbox" />
              <span>Low inventory items noted</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="print-checkbox" />
              <span>Problem orders resolved or documented</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="print-checkbox" />
              <span>Sale Closed toggle enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="print-checkbox" />
              <span>Seller packets printed (if applicable)</span>
            </div>
            <div className="mt-4 pt-2 border-t border-gray-300">
              <p className="font-semibold">Signed: ______________________________ Date: ______________</p>
            </div>
          </div>
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
