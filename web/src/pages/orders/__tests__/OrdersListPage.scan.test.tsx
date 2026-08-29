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

import { OrdersListPage } from '../OrdersListPage.js';

const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 1 };

describe('OrdersListPage scan-to-search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrdersList.mockResolvedValue(emptyPage);
    mockCustomersList.mockResolvedValue(emptyPage);
  });

  it('navigates to the customer when a scanned pickup code is submitted with Enter', async () => {
    mockCustomersList.mockImplementation(async (params: { search?: string }) =>
      params.search === 'PC-777'
        ? { ...emptyPage, items: [{ id: 'cust-9', displayName: 'Pat', pickupCode: 'PC-777' }], totalCount: 1 }
        : emptyPage);

    render(<MemoryRouter><OrdersListPage /></MemoryRouter>);
    await screen.findByText('No orders found');

    const input = screen.getByPlaceholderText(/Search orders/);
    fireEvent.change(input, { target: { value: 'PC-777' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/customers/cust-9'));
    expect(mockCustomersList).toHaveBeenCalledWith({ search: 'PC-777', pageSize: 1 });
  });

  it('navigates to the order when a scanned order number is submitted with Enter', async () => {
    mockOrdersList.mockImplementation(async (params: { search?: string; pageSize?: number }) =>
      params.search === 'ORD-0042' && params.pageSize === 1
        ? { ...emptyPage, items: [{ id: 'order-42', orderNumber: 'ORD-0042' }], totalCount: 1 }
        : emptyPage);

    render(<MemoryRouter><OrdersListPage /></MemoryRouter>);
    await screen.findByText('No orders found');

    const input = screen.getByPlaceholderText(/Search orders/);
    fireEvent.change(input, { target: { value: 'ORD-0042' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/orders/order-42'));
  });
});
