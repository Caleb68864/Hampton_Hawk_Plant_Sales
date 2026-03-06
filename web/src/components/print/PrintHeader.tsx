import { OrderNumberBarcode } from './OrderNumberBarcode.js';

interface PrintHeaderProps {
  subtitle?: string;
  customerName?: string;
  orderNumber?: string;
  pickupCode?: string;
  sellerName?: string;
  timestamp?: string;
}

export function PrintHeader({ subtitle, customerName, orderNumber, pickupCode, sellerName, timestamp }: PrintHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-center">Hampton Hawks Plant Sales</h1>
      {subtitle && <p className="text-center text-gray-600 text-sm mt-1">{subtitle}</p>}

      {(customerName || orderNumber || pickupCode || sellerName || timestamp) && (
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-t border-b border-gray-300 py-3">
          {customerName && (
            <div>
              <span className="font-semibold">Customer:</span> {customerName}
            </div>
          )}
          {orderNumber && (
            <div>
              <span className="font-semibold">Order #:</span> {orderNumber}
            </div>
          )}
          {sellerName && (
            <div>
              <span className="font-semibold">Seller:</span> {sellerName}
            </div>
          )}
          {timestamp && (
            <div>
              <span className="font-semibold">Date:</span> {timestamp}
            </div>
          )}
          {pickupCode && (
            <div className="col-span-2 mt-2 text-center">
              <span className="font-semibold text-sm">Pickup Code:</span>
              <div className="text-4xl font-mono font-bold tracking-widest mt-1">{pickupCode}</div>
            </div>
          )}
          {orderNumber && (
            <div className="col-span-2">
              <OrderNumberBarcode value={orderNumber} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
