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
  Accepted: 'text-green-700 bg-green-50',
  NotFound: 'text-red-700 bg-red-50',
  WrongOrder: 'text-red-700 bg-red-50',
  AlreadyFulfilled: 'text-amber-700 bg-amber-50',
  OutOfStock: 'text-red-700 bg-red-50',
  SaleClosedBlocked: 'text-red-700 bg-red-50',
};

export function ScanHistoryList({ entries }: ScanHistoryListProps) {
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent scans & recovery actions</h3>
      <div className="space-y-1">
        {entries.map((entry, idx) => (
          <div
            key={`${entry.timestamp}-${idx}`}
            className={`rounded px-3 py-2 text-sm ${resultColors[entry.result]}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono font-medium">{entry.barcode}</span>
                {entry.plantName && (
                  <span className="text-xs opacity-75">{entry.plantName}</span>
                )}
              </div>
              <span className="text-xs">{entry.result}</span>
            </div>
            <p className="text-xs mt-1 opacity-80">{entry.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
