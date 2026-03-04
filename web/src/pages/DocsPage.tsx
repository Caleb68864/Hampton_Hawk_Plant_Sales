import { useState } from 'react';

type Section = 'scan' | 'saleclosed' | 'admin' | 'walkup' | 'shortcuts' | 'cheatsheets' | 'labels' | 'troubleshooting';

const sections: { key: Section; label: string }[] = [
  { key: 'scan', label: 'Scan Workflow' },
  { key: 'saleclosed', label: 'Sale Closed' },
  { key: 'admin', label: 'Admin Override' },
  { key: 'walkup', label: 'Walk-Up Protection' },
  { key: 'shortcuts', label: 'Keyboard Shortcuts' },
  { key: 'cheatsheets', label: 'Cheat Sheets' },
  { key: 'labels', label: 'Label Printing' },
  { key: 'troubleshooting', label: 'Common Issues' },
];

export function DocsPage() {
  const [active, setActive] = useState<Section>('scan');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 p-5">
        <h1 className="text-2xl font-bold text-hawk-900">Volunteer Help Center</h1>
        <p className="text-sm text-hawk-800">Improved, practical guides for lookup, pickup, admin actions, and printing.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              active === s.key
                ? 'bg-hawk-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-hawk-50 hover:border-hawk-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {active === 'scan' && <ScanWorkflowSection />}
        {active === 'saleclosed' && <SaleClosedSection />}
        {active === 'admin' && <AdminOverrideSection />}
        {active === 'walkup' && <WalkUpProtectionSection />}
        {active === 'shortcuts' && <KeyboardShortcutsSection />}
        {active === 'cheatsheets' && <CheatSheetsSection />}
        {active === 'labels' && <LabelPrintingSection />}
        {active === 'troubleshooting' && <TroubleshootingSection />}
      </div>
    </div>
  );
}

function ScanWorkflowSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Pickup Scan Workflow</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <InfoCard title="1) Find Order">Search by customer name, pickup code, or order number from Pickup Lookup.</InfoCard>
        <InfoCard title="2) Scan Items">Keep focus in scan input, then scan each plant barcode.</InfoCard>
        <InfoCard title="3) Complete">When all lines are 100%, click Complete or use admin action if needed.</InfoCard>
      </div>
      <h3 className="text-lg font-medium text-gray-700">Result Meanings</h3>
      <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
        <li><span className="font-semibold text-green-700">Green:</span> matched and fulfilled successfully.</li>
        <li><span className="font-semibold text-amber-700">Amber:</span> duplicate/over-scan warning.</li>
        <li><span className="font-semibold text-red-700">Red:</span> no match or wrong order.</li>
        <li><span className="font-semibold text-blue-700">Blue:</span> line partially fulfilled.</li>
      </ul>
    </div>
  );
}

function SaleClosedSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Sale Closed Mode</h2>
      <p className="text-sm text-gray-600">Use when the fundraiser day is ended and new data changes must stop.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <InfoCard title="Locked While Closed">
          <ul className="list-disc list-inside space-y-1">
            <li>New order creation</li>
            <li>Order line modifications</li>
            <li>Walk-up order creation</li>
            <li>Imports</li>
          </ul>
        </InfoCard>
        <InfoCard title="Still Allowed">
          <ul className="list-disc list-inside space-y-1">
            <li>Viewing orders and reports</li>
            <li>Fulfillment on existing orders</li>
            <li>Admin force complete / reset</li>
            <li>Reopen sale (PIN required)</li>
          </ul>
        </InfoCard>
      </div>
    </div>
  );
}

function AdminOverrideSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Admin Override (PIN)</h2>
      <p className="text-sm text-gray-600">PIN-protected actions are audit logged. Always add clear reasons.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <InfoCard title="Actions That Need PIN">
          <ul className="list-disc list-inside space-y-1">
            <li>Close/Reopen sale</li>
            <li>Force-complete orders</li>
            <li>Reset fulfillment</li>
            <li>Walk-up inventory overrides</li>
          </ul>
        </InfoCard>
        <InfoCard title="Good Reason Examples">
          <ul className="list-disc list-inside space-y-1">
            <li>Customer accepted substitution</li>
            <li>Wrong order was scanned</li>
            <li>Late pickup window approved</li>
          </ul>
        </InfoCard>
      </div>
    </div>
  );
}

function WalkUpProtectionSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Walk-Up Inventory Protection</h2>
      <p className="text-sm text-gray-600">Walk-up inventory is calculated after reserving preorder commitments.</p>
      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
        <li>Select customer and add requested plants.</li>
        <li>If available quantity is enough, order line saves normally.</li>
        <li>If quantity exceeds available, prompt requires admin PIN + reason.</li>
        <li>Only override when approved by event lead.</li>
      </ol>
    </div>
  );
}

function KeyboardShortcutsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Keyboard Shortcuts</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden text-sm">
          <thead className="bg-hawk-50 text-hawk-900">
            <tr>
              <th className="px-4 py-2 text-left">Shortcut</th>
              <th className="px-4 py-2 text-left">Action</th>
              <th className="px-4 py-2 text-left">Where</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="px-4 py-2 font-mono">Ctrl+K</td><td className="px-4 py-2">Open quick find (customers, orders, plants, sellers)</td><td className="px-4 py-2">Anywhere</td></tr>
            <tr><td className="px-4 py-2 font-mono">/</td><td className="px-4 py-2">Focus search input</td><td className="px-4 py-2">List pages</td></tr>
            <tr><td className="px-4 py-2 font-mono">A-Z</td><td className="px-4 py-2">Jump letter tab</td><td className="px-4 py-2">Pickup lookup</td></tr>
            <tr><td className="px-4 py-2 font-mono">Esc</td><td className="px-4 py-2">Close overlay / clear</td><td className="px-4 py-2">Anywhere</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheatSheetsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Printable Counter Cheat Sheets</h2>
      <p className="text-gray-600 text-sm">Open in a new tab and print one-page references for each station.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CheatLink href="/print/cheatsheet/pickup" title="Pickup Station" desc="Scan, undo, complete, and recovery actions" />
        <CheatLink href="/print/cheatsheet/lookup" title="Lookup and Print" desc="Find orders and print order/seller docs" />
        <CheatLink href="/print/cheatsheet/admin" title="Admin Guide" desc="Sale controls, overrides, reset, inventory" />
        <CheatLink href="/print/cheatsheet/end-of-day" title="End-of-Day" desc="Closeout flow and signoff checklist" />
        <CheatLink href="/print/cheatsheet/thermal-labels" title="Thermal Labels" desc="1x2 printer setup + calibration" />
      </div>
    </div>
  );
}

function LabelPrintingSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Thermal Label Printing (1"×2")</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <InfoCard title="Required Settings">
          <ul className="list-disc list-inside space-y-1">
            <li>2.00" x 1.00" label size</li>
            <li>Scale 100% (never Fit to Page)</li>
            <li>Margins none/minimum</li>
            <li>Background graphics ON</li>
            <li>Gap/die-cut media type</li>
          </ul>
        </InfoCard>
        <InfoCard title="Print Quality Checklist">
          <ul className="list-disc list-inside space-y-1">
            <li>Run 1-up test first</li>
            <li>Calibrate if drifting</li>
            <li>Darkness only as needed</li>
            <li>Scan-test with pickup scanner</li>
          </ul>
        </InfoCard>
      </div>
      <a href="/print/cheatsheet/thermal-labels" target="_blank" rel="noopener noreferrer" className="inline-flex rounded-md bg-hawk-600 px-3 py-2 text-sm font-medium text-white hover:bg-hawk-700">
        Open Printable Thermal Label Guide
      </a>
    </div>
  );
}

function TroubleshootingSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Common Issues + Fast Fixes</h2>
      <div className="space-y-2 text-sm">
        <InfoCard title="Scanner not reading">Click the scan input first. Most scanners act like keyboards and submit Enter.</InfoCard>
        <InfoCard title="No Match on every scan">Verify correct order is open and barcode belongs to a plant line on that order.</InfoCard>
        <InfoCard title="Sale Closed message">Admin must reopen in Settings with PIN + reason.</InfoCard>
        <InfoCard title="Walk-up insufficient inventory">Reduce quantity or admin-override with approved reason.</InfoCard>
        <InfoCard title="Cannot complete order">Finish all scans or use Force Complete with PIN when appropriate.</InfoCard>
      </div>
    </div>
  );
}

function CheatLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-gray-200 p-4 hover:border-hawk-400 hover:bg-hawk-50">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </a>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <h3 className="mb-1 text-sm font-semibold text-hawk-800">{title}</h3>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
