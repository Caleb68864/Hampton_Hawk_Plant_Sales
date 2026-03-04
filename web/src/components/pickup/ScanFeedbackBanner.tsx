import type { FulfillmentResultType, ScanResponse } from '@/types/fulfillment.js';

interface ScanFeedbackBannerProps {
  result: ScanResponse | null;
  message: string;
  plantName?: string | null;
  nextAction?: string;
}

const resultStyles: Record<FulfillmentResultType, string> = {
  Accepted: 'bg-green-700 text-white border-2 border-green-900',
  NotFound: 'bg-red-700 text-white border-2 border-red-900',
  WrongOrder: 'bg-red-800 text-white border-2 border-red-950',
  AlreadyFulfilled: 'bg-amber-500 text-black border-2 border-amber-700',
  OutOfStock: 'bg-red-700 text-white border-2 border-red-900',
  SaleClosedBlocked: 'bg-red-700 text-white border-2 border-red-900',
};

export function ScanFeedbackBanner({ result, message, plantName, nextAction }: ScanFeedbackBannerProps) {
  if (!result) return null;

  return (
    <div
      className={`w-full rounded-xl px-6 py-5 text-center font-bold text-2xl ${resultStyles[result.result]} transform transition-all duration-200 shadow-lg`}
    >
      <div>{message}</div>
      {plantName && <div className="text-base font-medium mt-2 opacity-95">{plantName}</div>}
      {nextAction && <div className="text-base font-semibold mt-2">Next: {nextAction}</div>}
    </div>
  );
}
