import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetAdmin() {
  return (
    <PrintLayout backTo="/docs">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Admin Actions One-Page Guide</h1>
        <p className="text-sm text-hawk-800">Use when intervention is needed. Always enter a clear reason when the prompt asks for one.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-12 border-gold-300 bg-gold-50" title="Admin PIN Required For">
          <p>Sale status changes, kiosk lock/unlock, Force Complete, Reset current order, and other protected recovery actions.</p>
        </Card>

        <Card className="col-span-6" title="Close / Reopen Sale">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open <strong>Settings</strong>.</li>
            <li>Toggle <strong>Sale Closed</strong> on or off.</li>
            <li>Enter admin PIN + reason.</li>
            <li>Confirm the banner/state changed.</li>
          </ol>
        </Card>

        <Card className="col-span-6" title="Force Complete Order">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open the order on the pickup scan page.</li>
            <li>Click <strong>Force Complete</strong>.</li>
            <li>Enter PIN + specific reason.</li>
            <li>Verify the status becomes <strong>Complete</strong>.</li>
          </ol>
        </Card>

        <Card className="col-span-6" title="Reset Current Order">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open the order on the pickup scan page.</li>
            <li>Click <strong>Reset current order</strong>.</li>
            <li>Enter PIN + reason.</li>
            <li>Verify fulfillment returned to 0.</li>
          </ol>
        </Card>

        <Card className="col-span-6" title="Inventory + Import Controls">
          <ul className="list-disc pl-4 space-y-1">
            <li>Inventory page: use Set (absolute) or Adjust (+/-).</li>
            <li>Imports are blocked while the sale is closed.</li>
            <li>After import, review row-level issues before retrying.</li>
          </ul>
        </Card>

        <Card className="col-span-12 border-red-200 bg-red-50" title="Good Admin Notes (Examples)">
          <p>“Customer received substitutions approved by lead.” • “Reset after wrong order scanned at station 2.” • “Sale reopened for late pickup window.”</p>
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
