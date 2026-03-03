import { PrintLayout } from '@/components/print/PrintLayout.js';
import { PrintFooter } from '@/components/print/PrintFooter.js';

export function PrintCheatsheetThermal() {
  return (
    <PrintLayout backTo="/docs">
      <header className="mb-4 rounded-xl border-2 border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-hawk-700">Hampton Hawks Plant Sales</p>
        <h1 className="text-2xl font-bold text-hawk-900">Thermal Label Printer (1"×2") Quick Setup</h1>
        <p className="text-sm text-hawk-800">Run this checklist before any full label batch.</p>
      </header>

      <section className="grid grid-cols-12 gap-3 text-[13px] leading-tight">
        <Card className="col-span-6" title="Default Settings">
          <ul className="list-disc pl-4 space-y-1">
            <li>Label size: <strong>2.00" W × 1.00" H</strong></li>
            <li>Media: <strong>Gap / die-cut</strong></li>
            <li>Scale: <strong>100%</strong> (no Fit/Shrink)</li>
            <li>Margins: None or minimum</li>
            <li>Monochrome / Black &amp; White</li>
            <li>Speed: medium or slower</li>
          </ul>
        </Card>

        <Card className="col-span-6" title="Browser Print Checklist">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Open label page and click Print Labels.</li>
            <li>Select thermal printer.</li>
            <li>More settings → Scale 100, Margins None.</li>
            <li>Header/footer OFF, Background graphics ON.</li>
            <li>Print <strong>1-up test</strong> before full batch.</li>
          </ol>
        </Card>

        <Card className="col-span-7" title="If Labels Drift or Skip">
          <ol className="list-decimal pl-4 space-y-1">
            <li>Run media/gap calibration from printer utility.</li>
            <li>Verify driver stock size matches exactly 2"×1".</li>
            <li>Clean printhead using approved thermal wipes.</li>
            <li>Retest with one label and scan it at pickup station.</li>
          </ol>
        </Card>

        <Card className="col-span-5 border-gold-300 bg-gold-50" title="Scannability Rules">
          <ul className="list-disc pl-4 space-y-1">
            <li>Barcode fully visible (no clipping).</li>
            <li>Dark black bars (not gray/faded).</li>
            <li>Quiet zone preserved on both sides.</li>
            <li>Text readable under barcode.</li>
          </ul>
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
