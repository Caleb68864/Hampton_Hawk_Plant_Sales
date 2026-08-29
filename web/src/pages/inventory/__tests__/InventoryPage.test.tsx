import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { InventoryItem } from '../../../types/inventory.js';

const mockList = vi.fn();
const mockAdjust = vi.fn();

vi.mock('../../../api/inventory.js', () => ({
  inventoryApi: {
    list: (...args: unknown[]) => mockList(...args),
    update: vi.fn(),
    adjust: (...args: unknown[]) => mockAdjust(...args),
  },
}));

import { InventoryPage } from '../InventoryPage.js';

const item: InventoryItem = {
  id: 'inv-1',
  plantCatalogId: 'plant-1',
  onHandQty: 10,
  plantName: 'Tomato',
  plantSku: 'TOM-1',
  barcode: '000000000001',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function openAdjustModal() {
  render(<InventoryPage />);
  await screen.findByText('Tomato');
  fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
  fireEvent.change(screen.getByLabelText('Quantity Change (+/-)'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Reason *'), { target: { value: 'Recount' } });
  return screen.getByRole('button', { name: 'Apply Adjustment' });
}

describe('InventoryPage adjust modal', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockAdjust.mockReset();
    mockList.mockResolvedValue({ items: [item], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 });
  });

  it('sends the adjustment once even when Apply is clicked twice while pending', async () => {
    const pending = deferred<InventoryItem>();
    mockAdjust.mockReturnValue(pending.promise);

    const apply = await openAdjustModal();
    fireEvent.click(apply);
    fireEvent.click(apply);

    // The button reports the busy state and is disabled while the call is in flight.
    expect(screen.getByRole('button', { name: 'Applying…' })).toBeDisabled();
    expect(mockAdjust).toHaveBeenCalledTimes(1);
    expect(mockAdjust).toHaveBeenCalledWith({ plantCatalogId: 'plant-1', deltaQty: 3, reason: 'Recount' });

    await act(async () => { pending.resolve({ ...item, onHandQty: 13 }); });
    await waitFor(() => expect(screen.queryByText('Adjust Inventory')).not.toBeInTheDocument());
    expect(mockAdjust).toHaveBeenCalledTimes(1);
  });

  it('re-enables Apply and keeps the modal open when the adjustment fails', async () => {
    mockAdjust.mockRejectedValue(new Error('Server exploded'));

    const apply = await openAdjustModal();
    fireEvent.click(apply);

    await screen.findByText('Server exploded');
    expect(screen.getByText('Adjust Inventory')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Adjustment' })).toBeEnabled();
  });
});
