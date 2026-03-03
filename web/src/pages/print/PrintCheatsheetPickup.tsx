import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetPickup() {
  return (
    <PrintLayout backTo="/station">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Pickup Station One-Page Guide</h1>
        <p className="text-sm text-hawk-800">Keep this at the scan counter. Follow top-to-bottom for every pickup.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-7" title="Fast Workflow">
          <ol className="space-y-1 list-decimal pl-4">
            <li><strong>Find order:</strong> Station Home → <strong>Scan Pickups</strong> → search name / pickup code / order #.</li>
            <li><strong>Confirm identity:</strong> say customer name + order number out loud before scanning.</li>
            <li><strong>Scan each plant:</strong> keep cursor in the green scan box; scanner auto-presses Enter.</li>
            <li><strong>Watch feedback:</strong> green = good, amber = already filled, red = wrong or unknown barcode.</li>
            <li><strong>Finish:</strong> click <strong>Complete</strong> when all lines are 100%.</li>
          </ol>
        </Card>

        <Card className="col-span-5" title="Color Legend">
          <ul className="space-y-1">
            <li><span className="font-bold text-green-700">Green</span> — item matched + fulfilled.</li>
            <li><span className="font-bold text-amber-700">Amber</span> — duplicate or over-scan warning.</li>
            <li><span className="font-bold text-red-700">Red</span> — no match / wrong order.</li>
            <li><span className="font-bold text-blue-700">Blue</span> — partially fulfilled line.</li>
          </ul>
        </Card>

        <Card className="col-span-7" title="If Something Goes Wrong">
          <ul className="space-y-1 list-disc pl-4">
            <li><strong>Wrong scan:</strong> click <strong>Undo Last Scan</strong>.</li>
            <li><strong>Label damaged:</strong> use <strong>Manual Fulfill</strong> and pick the plant line.</li>
            <li><strong>Missing items:</strong> use <strong>Force Complete</strong> (admin PIN + reason).</li>
            <li><strong>Input not focused:</strong> click scan box or press <strong>Tab</strong>.</li>
            <li><strong>Need help fast:</strong> press <strong>Ctrl+K</strong> for Quick Find.</li>
          </ul>
        </Card>

        <Card className="col-span-5" title="Volunteer Script">
          <ol className="space-y-1 list-decimal pl-4">
            <li>“Hi! Name or pickup code?”</li>
            <li>“I have order #____ for ____.”</li>
            <li>“I’m scanning your items now.”</li>
            <li>“All set — you’re complete!”</li>
          </ol>
        </Card>

        <Card className="col-span-12 border-red-200 bg-red-50" title="Sale Closed Note">
          <p>New orders/changes are blocked, but existing order fulfillment can still proceed. Ask lead/admin if reopen is needed.</p>
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
