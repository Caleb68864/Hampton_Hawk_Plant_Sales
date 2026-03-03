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
      <h1 className="text-2xl font-bold text-gray-800">Documentation</h1>

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${
              active === s.key
                ? 'bg-hawk-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
      <h2 className="text-xl font-semibold text-gray-800">Scan Workflow</h2>
      <p className="text-gray-600">
        The pickup station uses barcode scanning to fulfill orders. When a customer arrives,
        look up their order by name, pickup code, or order number, then scan each plant's barcode.
      </p>
      <h3 className="text-lg font-medium text-gray-700">Scan Results</h3>
      <dl className="space-y-3">
        <div>
          <dt className="font-medium text-hawk-700">Match</dt>
          <dd className="text-gray-600 ml-4">
            The barcode matched a line item on the order. The fulfilled quantity was incremented.
            A success chime plays and the row highlights green.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-amber-700">Duplicate</dt>
          <dd className="text-gray-600 ml-4">
            The same barcode was scanned within 2 seconds. Ignored to prevent accidental double-scans.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-amber-700">Over-scan</dt>
          <dd className="text-gray-600 ml-4">
            The line item is already fully fulfilled. The scan is still recorded but flagged as an issue.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-red-700">No Match</dt>
          <dd className="text-gray-600 ml-4">
            The barcode does not match any line item on this order. An error sound plays.
            Check that you are scanning the correct order.
          </dd>
        </div>
      </dl>
      <h3 className="text-lg font-medium text-gray-700">Undo</h3>
      <p className="text-gray-600">
        Click "Undo Last Scan" to reverse the most recent scan. This decrements the fulfilled
        quantity and removes the scan event from history.
      </p>
    </div>
  );
}

function SaleClosedSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Sale Closed Mode</h2>
      <p className="text-gray-600">
        When the sale is closed, the system enters a restricted mode to prevent accidental changes
        after the fundraiser ends.
      </p>
      <h3 className="text-lg font-medium text-gray-700">What Gets Locked</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1">
        <li>Creating new orders is blocked</li>
        <li>Modifying existing order line items is blocked</li>
        <li>Walk-up order creation is blocked</li>
        <li>Importing new data is blocked</li>
      </ul>
      <h3 className="text-lg font-medium text-gray-700">What Admins Can Still Do</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1">
        <li>Continue scanning and fulfilling existing orders at pickup</li>
        <li>Force-complete or reset orders (with admin PIN)</li>
        <li>View all reports and dashboards</li>
        <li>Re-open the sale (with admin PIN)</li>
      </ul>
      <h3 className="text-lg font-medium text-gray-700">Toggling Sale Closed</h3>
      <p className="text-gray-600">
        Go to Settings and click "Close Sale" or "Reopen Sale". Both actions require the admin
        PIN and a reason, which is logged for audit purposes.
      </p>
    </div>
  );
}

function AdminOverrideSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Admin Override (PIN)</h2>
      <p className="text-gray-600">
        Certain actions require the admin PIN to prevent accidental or unauthorized changes.
        The PIN is configured via the <code className="bg-gray-100 px-1 rounded">APP_ADMIN_PIN</code> environment variable.
      </p>
      <h3 className="text-lg font-medium text-gray-700">Actions Requiring PIN</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1">
        <li>Force-completing an order with unfulfilled lines</li>
        <li>Resetting an order back to Open status</li>
        <li>Toggling the SaleClosed flag</li>
        <li>Exceeding available walk-up inventory</li>
      </ul>
      <h3 className="text-lg font-medium text-gray-700">How to Use</h3>
      <p className="text-gray-600">
        When a PIN-protected action is triggered, a modal dialog appears. Enter the 4-digit
        admin PIN and optionally provide a reason. The reason is stored in the audit log.
        If the PIN is incorrect, the action is rejected.
      </p>
    </div>
  );
}

function WalkUpProtectionSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Walk-Up Inventory Protection</h2>
      <p className="text-gray-600">
        Walk-up orders are day-of purchases that compete with pre-orders for the same inventory.
        The system protects pre-order commitments by calculating available walk-up quantity.
      </p>
      <h3 className="text-lg font-medium text-gray-700">How Available Quantity is Calculated</h3>
      <div className="bg-gray-50 rounded p-4 font-mono text-sm">
        Available for Walk-Up = Total On Hand - Sum of Unfulfilled Pre-Order Quantities
      </div>
      <p className="text-gray-600">
        For example, if you have 50 Red Maples on hand and pre-orders account for 35 unfulfilled,
        then 15 are available for walk-up customers.
      </p>
      <h3 className="text-lg font-medium text-gray-700">Exceeding Available Stock</h3>
      <p className="text-gray-600">
        If a walk-up order tries to add more than the available quantity, the system blocks the
        action. An admin can override this by entering the admin PIN, which logs the override
        reason for accountability.
      </p>
    </div>
  );
}

function KeyboardShortcutsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Keyboard Shortcuts</h2>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shortcut</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Where</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          <tr>
            <td className="px-4 py-3 text-sm font-mono">Ctrl + K</td>
            <td className="px-4 py-3 text-sm text-gray-600">Open Quick Find overlay</td>
            <td className="px-4 py-3 text-sm text-gray-500">Anywhere</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-sm font-mono">A - Z</td>
            <td className="px-4 py-3 text-sm text-gray-600">Jump to letter tab filter</td>
            <td className="px-4 py-3 text-sm text-gray-500">List pages with A-Z tabs</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-sm font-mono">/</td>
            <td className="px-4 py-3 text-sm text-gray-600">Focus the search input</td>
            <td className="px-4 py-3 text-sm text-gray-500">List pages</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-sm font-mono">Esc</td>
            <td className="px-4 py-3 text-sm text-gray-600">Close overlay / clear input</td>
            <td className="px-4 py-3 text-sm text-gray-500">Anywhere</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CheatSheetsSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Printable Cheat Sheets</h2>
      <p className="text-gray-600">
        Print these guides and keep them at each station for quick reference.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/print/cheatsheet/pickup"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 border rounded-lg hover:border-hawk-500 hover:bg-hawk-50 transition"
        >
          <h3 className="font-medium text-gray-800">Pickup Station</h3>
          <p className="text-sm text-gray-500">How to scan, undo, and complete orders</p>
        </a>
        <a
          href="/print/cheatsheet/lookup"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 border rounded-lg hover:border-hawk-500 hover:bg-hawk-50 transition"
        >
          <h3 className="font-medium text-gray-800">Lookup and Print</h3>
          <p className="text-sm text-gray-500">Finding orders and printing sheets</p>
        </a>
        <a
          href="/print/cheatsheet/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 border rounded-lg hover:border-hawk-500 hover:bg-hawk-50 transition"
        >
          <h3 className="font-medium text-gray-800">Admin Guide</h3>
          <p className="text-sm text-gray-500">Settings, overrides, and imports</p>
        </a>
        <a
          href="/print/cheatsheet/end-of-day"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 border rounded-lg hover:border-hawk-500 hover:bg-hawk-50 transition"
        >
          <h3 className="font-medium text-gray-800">End of Day</h3>
          <p className="text-sm text-gray-500">Closing the sale and final reports</p>
        </a>
      </div>
    </div>
  );
}


function LabelPrintingSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Thermal Label Printing</h2>
      <p className="text-gray-600">
        Plant labels are optimized for 1&quot; x 2&quot; thermal stock using Code128 barcodes.
      </p>
      <h3 className="text-lg font-medium text-gray-700">Recommended Printer Settings</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1">
        <li>Size: 2.00in × 1.00in</li>
        <li>Scale: 100% (disable fit-to-page)</li>
        <li>Margins: None or Minimum</li>
        <li>Background graphics: On</li>
        <li>Media type: Gap / die-cut labels</li>
      </ul>
      <h3 className="text-lg font-medium text-gray-700">Calibration Tips</h3>
      <ul className="list-disc list-inside text-gray-600 space-y-1">
        <li>Run media / gap calibration whenever label stock changes.</li>
        <li>Lower print speed if bars appear blurred.</li>
        <li>Increase darkness only until barcode bars are fully black.</li>
        <li>Print a single test sheet and scan before batch jobs.</li>
      </ul>
      <p className="text-sm text-gray-500">
        Full reference: <code className="bg-gray-100 px-1 rounded">docs/cheatsheets/thermal-label-printer-settings.md</code>
      </p>
    </div>
  );
}

function TroubleshootingSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">Common Issues</h2>
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-gray-800">Scanner is not reading barcodes</h3>
          <p className="text-gray-600">
            Make sure the cursor is focused in the scan input field (the large green-bordered input).
            Click on it or navigate to the pickup scan page. Most USB barcode scanners simulate
            keyboard input and press Enter automatically.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">Order shows "No Match" for every scan</h3>
          <p className="text-gray-600">
            Verify you are scanning the correct order. Check the order number and customer name.
            The barcode must match a plant SKU that exists as a line item on that specific order.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">"Sale is closed" error when creating an order</h3>
          <p className="text-gray-600">
            The sale has been closed by an admin. If this is unintentional, go to Settings and use
            the admin PIN to reopen the sale. Scanning and fulfillment of existing orders still works.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">Walk-up order blocked: "Insufficient inventory"</h3>
          <p className="text-gray-600">
            The requested quantity exceeds what is available after pre-order commitments. Reduce the
            quantity or use the admin PIN to override and proceed anyway.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">Cannot complete order -- lines are unfulfilled</h3>
          <p className="text-gray-600">
            The standard "Complete" button requires all lines to be fully scanned. If items are truly
            unavailable, use "Force Complete" with the admin PIN and provide a reason.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">Import shows many row errors</h3>
          <p className="text-gray-600">
            Check the import batch issues page for details. Common causes: missing required columns,
            duplicate SKUs, or invalid quantity values. Fix the source file and re-import.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-gray-800">Page is not loading / API errors</h3>
          <p className="text-gray-600">
            Check that the API server is running (visit /health). If using Docker, run{' '}
            <code className="bg-gray-100 px-1 rounded">docker-compose ps</code> to verify all services
            are healthy. Check browser console for network errors.
          </p>
        </div>
      </div>
    </div>
  );
}
