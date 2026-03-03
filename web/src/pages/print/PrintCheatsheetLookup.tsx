import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetLookup() {
  return (
    <PrintLayout backTo="/station">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Lookup + Print One-Page Guide</h1>
        <p className="text-sm text-hawk-800">For volunteers helping families find orders and print paperwork.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-8" title="Find the Right Order Quickly">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Start at <strong>Station Home</strong> → <strong>Lookup &amp; Print</strong>.</li>
            <li>Search by <strong>order #</strong>, <strong>customer</strong>, <strong>seller</strong>, or <strong>pickup code</strong>.</li>
            <li>Use status filter for Open / InProgress / Complete / Cancelled.</li>
            <li>Use A-Z tabs to jump by customer last-name initial.</li>
            <li>Open the order and verify customer before printing.</li>
          </ol>
        </Card>

        <Card className="col-span-4" title="Hotkeys">
          <ul className="space-y-1">
            <li><strong>Ctrl+K</strong> → global Quick Find</li>
            <li><strong>/</strong> → focus page search</li>
            <li><strong>A-Z</strong> → jump letter tabs</li>
            <li><strong>Esc</strong> → clear overlay/filter</li>
          </ul>
        </Card>

        <Card className="col-span-6" title="Print Order Sheet">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open order detail page.</li>
            <li>Click <strong>Print Order Sheet</strong>.</li>
            <li>In browser print: 100% scale, header/footer OFF.</li>
            <li>Hand sheet to pickup team with order number visible.</li>
          </ol>
        </Card>

        <Card className="col-span-6" title="Print Seller Packet">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Go to <strong>Sellers</strong> → open seller.</li>
            <li>Click <strong>Print Seller Packet</strong>.</li>
            <li>Select include/exclude toggles as needed.</li>
            <li>Print and paper-clip by seller.</li>
          </ol>
        </Card>

        <Card className="col-span-12" title="Label Printing Reminder (Plant Labels)">
          <p>Go to <strong>/print/labels</strong> and always run <strong>1-up test</strong> first. Use 100% scale and disable “Fit to page”.</p>
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
