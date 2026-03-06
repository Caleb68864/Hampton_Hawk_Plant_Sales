import { useState } from 'react';

type Section = 'kiosk' | 'pickup' | 'lookup' | 'saleclosed' | 'admin' | 'cheatsheets' | 'troubleshooting';

const sections: { key: Section; label: string }[] = [
  { key: 'kiosk', label: 'Kiosk Mode' },
  { key: 'pickup', label: 'Pickup Station' },
  { key: 'lookup', label: 'Lookup & Print' },
  { key: 'saleclosed', label: 'Sale Closed' },
  { key: 'admin', label: 'Admin Override' },
  { key: 'cheatsheets', label: 'Cheat Sheets' },
  { key: 'troubleshooting', label: 'Common Issues' },
];

export function DocsPage() {
  const [active, setActive] = useState<Section>('kiosk');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 p-5">
        <h1 className="text-2xl font-bold text-hawk-900">Volunteer Help Center</h1>
        <p className="text-sm text-hawk-800">Station-focused guides for kiosk mode, pickup, lookup/print, and admin actions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActive(section.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              active === section.key
                ? 'bg-hawk-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-hawk-50 hover:border-hawk-200'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {active === 'kiosk' && <KioskModeSection />}
        {active === 'pickup' && <PickupStationSection />}
        {active === 'lookup' && <LookupStationSection />}
        {active === 'saleclosed' && <SaleClosedSection />}
        {active === 'admin' && <AdminOverrideSection />}
        {active === 'cheatsheets' && <CheatSheetsSection />}
        {active === 'troubleshooting' && <TroubleshootingSection />}
      </div>
    </div>
  );
}

function KioskModeSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Device-Local Kiosk Mode</h2>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <InfoCard title="Start It">
          Open <strong>Settings</strong>, go to <strong>This Device</strong>, choose a profile, and enter the admin PIN.
        </InfoCard>
        <InfoCard title="What It Does">
          Kiosk mode hides the normal app navigation and keeps this browser inside one volunteer station.
        </InfoCard>
        <InfoCard title="Exit It">
          Use the <strong>Admin Unlock</strong> button in the kiosk header and enter the admin PIN again.
        </InfoCard>
      </div>
      <p className="text-sm text-gray-600">Kiosk mode affects only the current browser profile. Another laptop or browser window stays unchanged.</p>
    </div>
  );
}

function PickupStationSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Pickup Station Workflow</h2>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <InfoCard title="1. Find Order">Search by customer name, pickup code, or order number from Pickup Station.</InfoCard>
        <InfoCard title="2. Scan Items">Keep focus in the scan box, then scan each plant barcode.</InfoCard>
        <InfoCard title="3. Recover or Finish">Use Undo, Reset current order, Mark partial + reason, or Complete Order as needed.</InfoCard>
      </div>
      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
        <li><span className="font-semibold text-green-700">Green:</span> matched and fulfilled successfully.</li>
        <li><span className="font-semibold text-amber-700">Amber:</span> duplicate or already-fulfilled warning.</li>
        <li><span className="font-semibold text-red-700">Red:</span> wrong order, unknown barcode, out-of-stock, or sale-closed block.</li>
      </ul>
      <p className="text-sm text-gray-600">Need a paper copy? Use <strong>Print Order Sheet</strong>. Need a manual adjustment? <strong>Manual Fulfill</strong> is available only while the sale is open.</p>
    </div>
  );
}

function LookupStationSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Lookup & Print Station Workflow</h2>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <InfoCard title="Search">Use one search box for customer name, order number, or pickup code.</InfoCard>
        <InfoCard title="Print Order Sheet">Open the print preview in a new tab and hand the paperwork to the volunteer or customer.</InfoCard>
        <InfoCard title="Print Seller Packet">Use this only when the row shows the seller-packet button.</InfoCard>
      </div>
      <p className="text-sm text-gray-600">You can also browse by letter tabs or use the recent active orders list. This station does not create orders, edit orders, or open imports, reports, or settings.</p>
    </div>
  );
}

function SaleClosedSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Sale Closed Mode</h2>
      <p className="text-sm text-gray-600">Use when the fundraiser day is ended and data-changing workflows need to stop.</p>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <InfoCard title="Blocked While Closed">
          <ul className="list-disc list-inside space-y-1">
            <li>Barcode scanning and pickup fulfillment</li>
            <li>Manual fulfill from pickup</li>
            <li>New order creation</li>
            <li>Order line modifications and imports</li>
          </ul>
        </InfoCard>
        <InfoCard title="Still Allowed">
          <ul className="list-disc list-inside space-y-1">
            <li>Viewing orders, docs, and reports</li>
            <li>Printing paperwork</li>
            <li>Checking station status</li>
            <li>Reopening the sale with admin PIN + reason</li>
          </ul>
        </InfoCard>
      </div>
      <p className="text-sm text-gray-600">If pickup work must continue, a lead needs to reopen the sale first.</p>
    </div>
  );
}

function AdminOverrideSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Admin Override (PIN)</h2>
      <p className="text-sm text-gray-600">PIN-protected actions are audit logged. Use clear, specific reasons whenever the prompt asks for one.</p>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <InfoCard title="Actions That Need PIN">
          <ul className="list-disc list-inside space-y-1">
            <li>Close or reopen sale</li>
            <li>Force-complete orders</li>
            <li>Reset current order</li>
            <li>Enable or disable kiosk mode</li>
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

function CheatSheetsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Printable Counter Cheat Sheets</h2>
      <p className="text-sm text-gray-600">Open in a new tab and print one-page references for each station.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CheatLink href="/print/cheatsheet/pickup" title="Pickup Station" desc="Kiosk startup, scanning, recovery, and completion" />
        <CheatLink href="/print/cheatsheet/lookup" title="Lookup and Print" desc="Search, browse recent orders, and print paperwork" />
        <CheatLink href="/print/cheatsheet/admin" title="Admin Guide" desc="Sale controls, overrides, reset, and inventory actions" />
        <CheatLink href="/print/cheatsheet/end-of-day" title="End-of-Day" desc="Closeout flow and signoff checklist" />
        <CheatLink href="/print/cheatsheet/thermal-labels" title="Thermal Labels" desc="1x2 printer setup and calibration" />
      </div>
    </div>
  );
}

function TroubleshootingSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Common Issues + Fast Fixes</h2>
      <div className="space-y-2 text-sm">
        <InfoCard title="Print preview will not open">Allow pop-ups for the site, then try the print button again.</InfoCard>
        <InfoCard title="Scanner not reading">Click the scan input first. Most scanners act like keyboards and submit Enter.</InfoCard>
        <InfoCard title="No match found">Stay in the same station, double-check the customer name or pickup code, and search again.</InfoCard>
        <InfoCard title="Sale Closed message">A lead must reopen the sale in Settings with admin PIN + reason before pickup scanning can continue.</InfoCard>
        <InfoCard title="Need to leave kiosk mode">Use the Admin Unlock button in the kiosk header and enter the admin PIN.</InfoCard>
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
