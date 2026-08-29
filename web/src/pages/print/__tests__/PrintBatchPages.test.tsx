import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Order } from '../../../types/order.js';
import type { Customer } from '../../../types/customer.js';

const mockOrderGetById = vi.fn();
const mockOrdersList = vi.fn();
const mockCustomerGetById = vi.fn();

vi.mock('../../../api/orders.js', () => ({
  ordersApi: {
    getById: (...args: unknown[]) => mockOrderGetById(...args),
    list: (...args: unknown[]) => mockOrdersList(...args),
  },
}));

vi.mock('../../../api/customers.js', () => ({
  customersApi: {
    getById: (...args: unknown[]) => mockCustomerGetById(...args),
  },
}));

vi.mock('../../../components/print/CustomerPickListSheet.js', () => ({
  CustomerPickListSheet: ({ customer, orders }: { customer: Customer; orders: Order[] }) => (
    <div data-testid="customer-sheet">{customer.displayName}: {orders.map((o) => o.orderNumber).join(',')}</div>
  ),
}));

import { PrintOrdersBatchPage } from '../PrintOrdersBatchPage.js';
import { PrintCustomersBatchPage } from '../PrintCustomersBatchPage.js';

function makeOrder(id: string, customerId = 'cust-1'): Order {
  return {
    id, customerId, customerDisplayName: 'Pat', sellerId: null, sellerDisplayName: null,
    orderNumber: `ORD-${id}`, status: 'Open', isWalkUp: false, hasIssue: false, lines: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeCustomer(id: string): Customer {
  return {
    id, firstName: null, lastName: null, displayName: `Customer ${id}`, phone: null, email: null,
    pickupCode: `PC-${id}`, picklistBarcode: '', notes: null, createdAt: '', updatedAt: '',
  };
}

describe('PrintOrdersBatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prints the orders that loaded and notes the ones that did not', async () => {
    mockOrderGetById.mockImplementation(async (id: string) => {
      if (id === 'b') throw new Error('404 Not Found');
      return makeOrder(id);
    });

    render(
      <MemoryRouter initialEntries={['/print/orders?ids=a,b,c']}>
        <PrintOrdersBatchPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('1 order could not be loaded and is not included in this print run.')).toBeInTheDocument();
    expect(screen.getAllByText('ORD-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ORD-c').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('ORD-b')).toHaveLength(0);
    expect(mockOrderGetById).toHaveBeenCalledTimes(3);
  });

  it('shows an error only when nothing could be loaded', async () => {
    mockOrderGetById.mockRejectedValue(new Error('down'));

    render(
      <MemoryRouter initialEntries={['/print/orders?ids=a,b']}>
        <PrintOrdersBatchPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('None of the selected orders could be loaded.')).toBeInTheDocument();
  });

  it('never has more than six order fetches in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    mockOrderGetById.mockImplementation(async (id: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return makeOrder(id);
    });
    const ids = Array.from({ length: 20 }, (_, i) => `o${i}`).join(',');

    render(
      <MemoryRouter initialEntries={[`/print/orders?ids=${ids}`]}>
        <PrintOrdersBatchPage />
      </MemoryRouter>,
    );

    await screen.findAllByText('ORD-o19');
    expect(mockOrderGetById).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(6);
  });
});

describe('PrintCustomersBatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the batch when one customer and one order fail to load', async () => {
    mockCustomerGetById.mockImplementation(async (id: string) => {
      if (id === 'gone') throw new Error('404');
      return makeCustomer(id);
    });
    mockOrdersList.mockImplementation(async ({ customerId }: { customerId: string }) => ({
      items: customerId === 'c1' ? [makeOrder('x', 'c1'), makeOrder('y', 'c1')] : [],
      totalCount: 0, page: 1, pageSize: 500, totalPages: 1,
    }));
    mockOrderGetById.mockImplementation(async (id: string) => {
      if (id === 'y') throw new Error('deleted');
      return makeOrder(id, 'c1');
    });

    render(
      <MemoryRouter initialEntries={['/print/customers?ids=c1,gone,c2']}>
        <PrintCustomersBatchPage />
      </MemoryRouter>,
    );

    const sheets = await screen.findAllByTestId('customer-sheet');
    expect(sheets.map((s) => s.textContent)).toEqual(['Customer c1: ORD-x', 'Customer c2: ']);
    const note = screen.getByRole('status');
    expect(note).toHaveTextContent('1 customer could not be loaded.');
    expect(note).toHaveTextContent('1 order could not be loaded.');
  });
});
