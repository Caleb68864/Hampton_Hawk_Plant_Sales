import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockOrdersList = vi.fn();
const mockCustomersList = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../api/orders.js', () => ({
  ordersApi: { list: (...args: unknown[]) => mockOrdersList(...args) },
}));

vi.mock('../../../api/customers.js', () => ({
  customersApi: { list: (...args: unknown[]) => mockCustomersList(...args) },
}));

import { CustomersListPage } from '../CustomersListPage.js';

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 1 };

describe('CustomersListPage scan-to-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrdersList.mockResolvedValue(emptyPage);
    mockCustomersList.mockResolvedValue(emptyPage);
  });

  it('navigates to the customer when a scanned pickup code is submitted with Enter', async () => {
    mockCustomersList.mockImplementation(async (params: { search?: string; pageSize?: number }) =>
      params.search === 'PC-777' && params.pageSize === 1
        ? { ...emptyPage, items: [{ id: 'cust-9', displayName: 'Pat', pickupCode: 'PC-777' }], totalCount: 1 }
        : emptyPage);

    render(<MemoryRouter><CustomersListPage /></MemoryRouter>);
    await screen.findByText(/No customers/i);

    const input = screen.getByPlaceholderText(/Search customers/);
    fireEvent.change(input, { target: { value: 'PC-777' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/customers/cust-9'));
  });
});
