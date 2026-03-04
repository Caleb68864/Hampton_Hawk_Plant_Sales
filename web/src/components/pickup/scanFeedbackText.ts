import type { ScanResponse } from '@/types/fulfillment.js';

interface ScanDisplayFields {
  plantName?: string;
  qtyFulfilled?: number;
  qtyOrdered?: number;
}

export function getScanDisplayFields(result: ScanResponse | null): ScanDisplayFields {
  return {
    plantName: result?.plant?.name,
    qtyFulfilled: result?.line?.qtyFulfilled,
    qtyOrdered: result?.line?.qtyOrdered,
  };
}

export function getScanResultMessage(result: ScanResponse | null): string {
  if (!result) return '';

  const { plantName, qtyFulfilled, qtyOrdered } = getScanDisplayFields(result);

  if (result.result === 'Accepted') {
    if (plantName && qtyFulfilled !== undefined && qtyOrdered !== undefined) {
      return `${plantName} accepted (${qtyFulfilled}/${qtyOrdered})`;
    }
    if (plantName) return `${plantName} accepted`;
    return 'Scan accepted';
  }

  if (result.result === 'NotFound') {
    return 'Barcode not found';
  }

  if (result.result === 'WrongOrder') {
    return plantName ? `${plantName} belongs to a different order` : 'Plant belongs to a different order';
  }

  if (result.result === 'AlreadyFulfilled') {
    return plantName ? `${plantName} already fulfilled` : 'Line already fulfilled';
  }

  if (result.result === 'OutOfStock') {
    return plantName ? `${plantName} is out of stock` : 'Plant is out of stock';
  }

  return 'Sale closed. Scanning is blocked';
}
