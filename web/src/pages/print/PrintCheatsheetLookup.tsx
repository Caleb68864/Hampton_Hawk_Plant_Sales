import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetLookup() {
  return (
    <PrintLayout backTo="/docs">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Lookup & Print One-Page Guide</h1>
        <p className="text-sm text-hawk-800">For volunteers who search orders and print the paperwork families need.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-8" title="Start the Station">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open <strong>Settings</strong> on this browser.</li>
            <li>Under <strong>This Device</strong>, choose <strong>Lookup &amp; Print</strong>.</li>
            <li>Enter the admin PIN to enable kiosk mode.</li>
            <li>Verify the header says <strong>Lookup &amp; Print Station</strong>.</li>
          </ol>
        </Card>

        <Card className="col-span-4" title="Use This Search Box">
          <ul className="space-y-1">
            <li>Customer name</li>
            <li>Order number</li>
            <li>Pickup code</li>
            <li>No extra filters needed</li>
          </ul>
        </Card>

        <Card className="col-span-6" title="Print Order Sheet">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Find the order in the station search.</li>
            <li>Click <strong>Print Order Sheet</strong>.</li>
            <li>The print preview opens in a new tab.</li>
            <li>Hand the printed sheet to pickup volunteers or the customer.</li>
          </ol>
        </Card>

        <Card className="col-span-6" title="Print Seller Packet">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Use only when the order shows a seller packet button.</li>
            <li>Click <strong>Print Seller Packet</strong>.</li>
            <li>The original station tab stays open while printing.</li>
            <li>Close the print tab to return to the station.</li>
          </ol>
        </Card>

        <Card className="col-span-12 border-red-200 bg-red-50" title="Station Safety Rules">
          <p>This station does not create orders, edit orders, or open imports, reports, or settings. If you need those tools, ask a lead to unlock the browser.</p>
        </Card>
      </section>

      <PrintFooter showNotesLines={false} />
    </PrintLayout>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-hawk-200 bg-white p-3 ${className}`}>
      <h2 className="mb-1 border-b border-hawk-100 pb-1 text-sm font-bold uppercase tracking-wide text-hawk-800">{title}</h2>
      {children}
    </div>
  );
}
