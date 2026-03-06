import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetPickup() {
  return (
    <PrintLayout backTo="/docs">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Pickup Station One-Page Guide</h1>
        <p className="text-sm text-hawk-800">Keep this at the pickup counter. It matches the kiosk-mode pickup station.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-7" title="Start the Station">
          <ol className="space-y-1 list-decimal pl-4">
            <li>Open <strong>Settings</strong> on this browser.</li>
            <li>Under <strong>This Device</strong>, choose <strong>Pickup</strong>.</li>
            <li>Enter the admin PIN to enable kiosk mode.</li>
            <li>Verify the header now says <strong>Pickup Station</strong>.</li>
          </ol>
        </Card>

        <Card className="col-span-5" title="Color Legend">
          <ul className="space-y-1">
            <li><span className="font-bold text-green-700">Green</span> - item matched and fulfilled.</li>
            <li><span className="font-bold text-amber-700">Amber</span> - duplicate or over-scan warning.</li>
            <li><span className="font-bold text-red-700">Red</span> - wrong order or unknown barcode.</li>
            <li><span className="font-bold text-blue-700">Blue</span> - partially fulfilled line.</li>
          </ul>
        </Card>

        <Card className="col-span-7" title="Fast Workflow">
          <ol className="space-y-1 list-decimal pl-4">
            <li><strong>Find order:</strong> search name, pickup code, or order number.</li>
            <li><strong>Confirm identity:</strong> say customer name and order number out loud.</li>
            <li><strong>Scan each plant:</strong> keep the cursor in the scan box.</li>
            <li><strong>Finish:</strong> click <strong>Complete Order</strong> when all lines are done.</li>
          </ol>
        </Card>

        <Card className="col-span-5" title="If Something Goes Wrong">
          <ul className="space-y-1 list-disc pl-4">
            <li><strong>Wrong scan:</strong> click <strong>Undo last scan</strong>.</li>
            <li><strong>Need paperwork:</strong> click <strong>Print Order Sheet</strong>.</li>
            <li><strong>Missing items:</strong> use <strong>Force Complete</strong> only with admin approval.</li>
            <li><strong>Need full app access:</strong> use <strong>Admin Unlock</strong> in the kiosk header.</li>
          </ul>
        </Card>

        <Card className="col-span-12 border-red-200 bg-red-50" title="Sale Closed Note">
          <p>New orders and changes are blocked, but existing order fulfillment can still proceed. Ask the lead if the sale needs to be reopened.</p>
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
