import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetEndOfDay() {
  return (
    <PrintLayout backTo="/station">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">End-of-Day Counter Checklist</h1>
        <p className="text-sm text-hawk-800">One page for closeout volunteers + lead signer.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-8" title="Closeout Flow">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Orders page: filter Open + InProgress and resolve each one.</li>
            <li>Dashboard: check problem orders + low inventory panels.</li>
            <li>Inventory page: note zero/negative counts for reconciliation.</li>
            <li>Settings: <strong>Close Sale</strong> (PIN + reason).</li>
            <li>Print final docs: dashboard snapshot, needed order sheets, seller packets.</li>
          </ol>
        </Card>

        <Card className="col-span-4" title="If Order Cannot Finish">
          <ul className="list-disc pl-4 space-y-1">
            <li>Try pickup scan completion first.</li>
            <li>If unavailable items: Force Complete + reason.</li>
            <li>If wrong scans: Reset + re-scan.</li>
          </ul>
        </Card>

        <Card className="col-span-12" title="Sign-Off">
          <Checklist item="All remaining orders reviewed and resolved/documented" />
          <Checklist item="Dashboard checked for problem orders" />
          <Checklist item="Inventory reconciliation notes captured" />
          <Checklist item="Sale status set to CLOSED" />
          <Checklist item="Final printouts completed" />
          <p className="mt-3 border-t border-hawk-200 pt-2 font-semibold">Lead Signature: ______________________ Date: ______________</p>
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

function Checklist({ item }: { item: string }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="print-checkbox" />
      <span>{item}</span>
    </div>
  );
}
