import type { FulfillmentResultType } from '@/types/fulfillment.js';

export interface ScanHistoryEntry {
  barcode: string;
  result: FulfillmentResultType;
  message: string;
  plantName?: string | null;
  timestamp: number;
}

interface ScanHistoryListProps {
  entries: ScanHistoryEntry[];
}

const resultColors: Record<FulfillmentResultType, string> = {
  Accepted: 'text-green-800 bg-green-100 border-green-300',
  NotFound: 'text-red-800 bg-red-100 border-red-300',
  WrongOrder: 'text-red-900 bg-red-100 border-red-400',
  AlreadyFulfilled: 'text-amber-900 bg-amber-100 border-amber-300',
  OutOfStock: 'text-red-800 bg-red-100 border-red-300',
  SaleClosedBlocked: 'text-red-800 bg-red-100 border-red-300',
};

const plainReasons: Record<FulfillmentResultType, string> = {
  Accepted: 'Matched this order and counted toward fulfillment.',
  NotFound: 'Barcode was not recognized by the system.',
  WrongOrder: 'Plant belongs to a different order.',
  AlreadyFulfilled: 'This line is already fully fulfilled.',
  OutOfStock: 'No inventory available for this scan.',
  SaleClosedBlocked: 'Sale is closed, so scan fulfillment is blocked.',
};

export function ScanHistoryList({ entries }: ScanHistoryListProps) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Scans (Last 3)</h3>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={`${entry.timestamp}-${idx}`}
            className={`rounded border px-3 py-2 text-sm ${resultColors[entry.result]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-semibold">{entry.barcode}</span>
                {entry.plantName && (
                  <span className="text-xs opacity-80">{entry.plantName}</span>
                )}
              </div>
              <span className="text-xs font-semibold uppercase">{entry.result}</span>
            </div>
            <p className="mt-1 text-xs">Reason: {plainReasons[entry.result]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
