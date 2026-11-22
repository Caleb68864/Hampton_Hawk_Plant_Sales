import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockDelete = vi.fn();
const mockOpenPinModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/api/customers.js', () => ({
  customersApi: {
    getById: async () => ({ id: 'c-1', displayName: 'Jane Doe', firstName: null, lastName: null, phone: null, email: null, notes: null, pickupCode: 'AB2CD3', picklistBarcode: 'PLB-x' }),
    delete: (...args: unknown[]) => mockDelete(...args),
    update: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('@/api/orders.js', () => ({
  ordersApi: { list: async () => ({ items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 }) },
}));
vi.mock('@/stores/authStore.js', () => ({
  useAuthStore: <T,>(selector: (s: { openPinModal: typeof mockOpenPinModal }) => T) => selector({ openPinModal: mockOpenPinModal }),
}));

import { CustomerDetailPage } from '../CustomerDetailPage.js';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/customers/c-1']}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function confirmDelete() {
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Customer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
}

describe('CustomerDetailPage delete', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDelete.mockReset();
    mockOpenPinModal.mockReset();
    mockDelete.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('asks for the admin PIN and sends it with the delete', async () => {
    mockOpenPinModal.mockResolvedValue({ pin: '1234', reason: 'duplicate record' });
    renderPage();
    await confirmDelete();

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('c-1', '1234', 'duplicate record'));
    expect(mockNavigate).toHaveBeenCalledWith('/customers', { replace: true });
  });

  it('deletes nothing when the PIN prompt is cancelled', async () => {
    mockOpenPinModal.mockResolvedValue(null);
    renderPage();
    await confirmDelete();

    await waitFor(() => expect(mockOpenPinModal).toHaveBeenCalled());
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
