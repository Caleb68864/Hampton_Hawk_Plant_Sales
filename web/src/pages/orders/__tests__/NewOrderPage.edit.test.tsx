import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Order, OrderLine } from '../../../types/order.js';
import type { Customer } from '../../../types/customer.js';
import type { Plant } from '../../../types/plant.js';

const mockNavigate = vi.fn();
const mockGetById = vi.fn();
const mockUpdate = vi.fn();
const mockAddLine = vi.fn();
const mockUpdateLine = vi.fn();
const mockDeleteLine = vi.fn();
const mockCustomerGetById = vi.fn();
const mockPlantList = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../api/orders.js', () => ({
  ordersApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    addLine: (...args: unknown[]) => mockAddLine(...args),
    updateLine: (...args: unknown[]) => mockUpdateLine(...args),
    deleteLine: (...args: unknown[]) => mockDeleteLine(...args),
    create: vi.fn(),
  },
}));

vi.mock('../../../api/customers.js', () => ({
  customersApi: {
    getById: (...args: unknown[]) => mockCustomerGetById(...args),
    list: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 5, totalPages: 0 }),
    create: vi.fn(),
  },
}));

vi.mock('../../../api/sellers.js', () => ({
  sellersApi: {
    getById: vi.fn(),
    list: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 5, totalPages: 0 }),
  },
}));

vi.mock('../../../api/plants.js', () => ({
  plantsApi: {
    list: (...args: unknown[]) => mockPlantList(...args),
  },
}));

import { NewOrderPage } from '../NewOrderPage.js';

const customer: Customer = {
  id: 'cust-1', firstName: null, lastName: null, displayName: 'Pat Grower', phone: null, email: null,
  pickupCode: 'PC-1', picklistBarcode: 'PB-1', notes: null, createdAt: '', updatedAt: '',
};

function makeLine(id: string, plantId: string, plantName: string): OrderLine {
  return {
    id, orderId: 'order-1', plantCatalogId: plantId, plantName, plantSku: plantId.toUpperCase(),
    qtyOrdered: 1, qtyFulfilled: 0, notes: null, createdAt: '', updatedAt: '',
  };
}

function makeOrder(lines: OrderLine[]): Order {
  return {
    id: 'order-1', customerId: 'cust-1', customerDisplayName: 'Pat Grower', sellerId: null, sellerDisplayName: null,
    orderNumber: 'ORD-1', status: 'Open', isWalkUp: false, hasIssue: false, lines, createdAt: '', updatedAt: '',
  };
}

function makePlant(id: string, name: string): Plant {
  return { id, sku: id.toUpperCase(), name, variant: null, price: null, barcode: '', barcodeLockedAt: null, isActive: true, createdAt: '', updatedAt: '' };
}

async function addPlantViaSearch(plant: Plant) {
  mockPlantList.mockResolvedValueOnce({ items: [plant], totalCount: 1, page: 1, pageSize: 10, totalPages: 1 });
  fireEvent.change(screen.getByPlaceholderText('Search plants to add...'), { target: { value: plant.name } });
  const result = await screen.findByRole('button', { name: new RegExp(plant.name) }, { timeout: 2000 });
  fireEvent.click(result);
}

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={['/orders/order-1/edit']}>
      <Routes>
        <Route path="/orders/:id/edit" element={<NewOrderPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewOrderPage edit-save recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCustomerGetById.mockResolvedValue(customer);
    mockUpdate.mockResolvedValue(makeOrder([makeLine('line-existing', 'plant-existing', 'Basil')]));
    mockUpdateLine.mockResolvedValue({});
    mockDeleteLine.mockResolvedValue(undefined);
  });

  it('re-syncs from the server after a partial failure so committed lines are not re-posted', async () => {
    const existing = makeLine('line-existing', 'plant-existing', 'Basil');
    // First load: one existing line. After the partial failure the server has
    // the existing line plus the first added line (Tomato) but not the second (Pepper).
    mockGetById
      .mockResolvedValueOnce(makeOrder([existing]))
      .mockResolvedValueOnce(makeOrder([existing, makeLine('line-tomato', 'plant-tomato', 'Tomato')]));

    mockAddLine
      .mockResolvedValueOnce(makeLine('line-tomato', 'plant-tomato', 'Tomato'))
      .mockRejectedValueOnce(new Error('Pepper is out of stock'));

    renderEditPage();
    await screen.findByText('Pat Grower');
    expect(screen.getByText('Basil')).toBeInTheDocument();

    await addPlantViaSearch(makePlant('plant-tomato', 'Tomato'));
    await addPlantViaSearch(makePlant('plant-pepper', 'Pepper'));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText(/Pepper is out of stock/);
    expect(screen.getByText(/reloaded from the server/)).toBeInTheDocument();
    expect(mockAddLine).toHaveBeenCalledTimes(2);
    // The page re-fetched the order after the failure...
    expect(mockGetById).toHaveBeenCalledTimes(2);
    // ...and rebuilt the lines from it: Tomato survives (now with a lineId),
    // Pepper (never persisted) is gone.
    expect(screen.getByText('Tomato')).toBeInTheDocument();
    expect(screen.queryByText('Pepper')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    // Saving again must NOT re-POST Tomato as a fresh line.
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/orders/order-1', { replace: true }));
    expect(mockAddLine).toHaveBeenCalledTimes(2);
  });

  it('still reports the error when the re-fetch itself fails', async () => {
    mockGetById
      .mockResolvedValueOnce(makeOrder([makeLine('line-existing', 'plant-existing', 'Basil')]))
      .mockRejectedValueOnce(new Error('network down'));
    mockUpdate.mockRejectedValueOnce(new Error('PUT failed'));

    renderEditPage();
    await screen.findByText('Pat Grower');

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await screen.findByText(/PUT failed/);
    expect(screen.getByText(/could not be reloaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });
});
