import { useEffect, useState } from 'react';
import type { FulfillmentResultType } from '@/types/fulfillment.js';

interface ScanFeedbackBannerProps {
  result: FulfillmentResultType | null;
  message: string;
  plantName?: string | null;
}

const resultStyles: Record<FulfillmentResultType, string> = {
  Accepted: 'bg-green-500 text-white',
  NotFound: 'bg-red-500 text-white',
  WrongOrder: 'bg-red-500 text-white',
  AlreadyFulfilled: 'bg-amber-500 text-white',
  OutOfStock: 'bg-red-500 text-white',
  SaleClosedBlocked: 'bg-red-500 text-white',
};

export function ScanFeedbackBanner({ result, message, plantName }: ScanFeedbackBannerProps) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!result) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(timer);
  }, [result, message]);

  if (!result) return null;

  return (
    <div
      className={`w-full rounded-lg px-4 py-3 text-center font-semibold text-lg transition-opacity ${
        resultStyles[result]
      } ${flash ? 'opacity-100 scale-105' : 'opacity-90 scale-100'} transform transition-all duration-200`}
    >
      <div>{message}</div>
      {plantName && <div className="text-sm font-normal mt-1">{plantName}</div>}
    </div>
  );
}
