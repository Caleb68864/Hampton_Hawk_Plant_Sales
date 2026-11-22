import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockGetEvents = vi.fn();
vi.mock('@/api/orders.js', () => ({ ordersApi: { getEvents: (...a: unknown[]) => mockGetEvents(...a) } }));

import { OrderScanHistory } from '../OrderScanHistory.js';

describe('OrderScanHistory', () => {
  it('shows each event with how it was made and the station login', async () => {
    mockGetEvents.mockResolvedValue([
      { id: 'e1', orderId: 'o-1', plantCatalogId: 'p', barcode: '1001', result: 'Accepted', message: 'Scanned 1x Fern', userId: 'u-1', userName: 'pickup-2', source: 'PickupScan', createdAt: '2026-05-09T15:00:00Z' },
      { id: 'e2', orderId: 'o-1', plantCatalogId: null, barcode: 'MANUAL', result: 'Accepted', message: null, userId: null, source: null, createdAt: '2026-05-09T14:00:00Z' },
    ]);

    render(<OrderScanHistory orderId="o-1" />);

    expect(await screen.findByText('pickup-2')).toBeInTheDocument();
    expect(screen.getByText('Pickup scan')).toBeInTheDocument();
    expect(screen.getByText('Scanned 1x Fern')).toBeInTheDocument();
    expect(mockGetEvents).toHaveBeenCalledWith('o-1');
  });
});
