import { useEffect, useMemo, useState } from 'react';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import { buildPrintOrderPath, buildPrintSellerPacketPath } from '@/utils/printRoutes.js';
import {
  buildLookupPrintLetterRows,
  buildLookupPrintRecentRows,
  buildLookupPrintRows,
  matchesLookupPrintLetterFilter,
} from './lookupPrintSearch.js';
import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

const RECENT_ORDER_LIMIT = 12;
const RECENT_ORDER_STATUSES: ReadonlyArray<Order['status']> = ['Open', 'InProgress'];
const LETTER_FILTER_CUSTOMER_PAGE_SIZE = 200;
const LETTER_FILTER_MAX_PAGES = 10;
const LETTER_FILTER_ORDER_PAGE_SIZE = 100;

function dedupeOrders(orders: Order[]): Order[] {
  const byId = new Map<string, Order>();
  orders.forEach((order) => {
    byId.set(order.id, order);
  });
  return [...byId.values()];
}

function sortOrdersNewestFirst(left: Order, right: Order): number {
  const createdAtComparison = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (!Number.isNaN(createdAtComparison) && createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.orderNumber.localeCompare(left.orderNumber);
}

async function buildCustomersById(orders: Order[], seedCustomers: Customer[] = []): Promise<Map<string, Customer>> {
  const customerMap = new Map<string, Customer>();

  seedCustomers.forEach((customer) => {
    customerMap.set(customer.id, customer);
  });

  const missingCustomerIds = [...new Set(orders.map((order) => order.customerId))]
    .filter((customerId) => !customerMap.has(customerId));

  const missingCustomers = await Promise.all(
    missingCustomerIds.map(async (customerId) => {
      try {
        return await customersApi.getById(customerId);
      } catch {
        return null;
      }
    }),
  );

  missingCustomers.filter(Boolean).forEach((customer) => {
    customerMap.set(customer!.id, customer!);
  });

  return customerMap;
}

async function loadAllCustomersForLetterFilter(): Promise<Customer[]> {
  const firstPage = await customersApi.list({ page: 1, pageSize: LETTER_FILTER_CUSTOMER_PAGE_SIZE });
  const pageCount = Math.min(firstPage.totalPages, LETTER_FILTER_MAX_PAGES);

  if (pageCount <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => customersApi.list({
      page: index + 2,
      pageSize: LETTER_FILTER_CUSTOMER_PAGE_SIZE,
    })),
  );

  return [
    ...firstPage.items,
    ...remainingPages.flatMap((result) => result.items),
  ];
}

function getLetterFilterTitle(letter: string): string {
  if (letter === '#') {
    return 'Number and symbol names';
  }

  return `${letter} last names`;
}

export function LookupPrintStationPage() {
  const kioskProfile = useKioskStore((s) => s.session?.profile ?? null);
  const [azFilter, setAzFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersById, setCustomersById] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedSearch = search.trim();
  const isSearchMode = trimmedSearch.length > 0;
  const isLetterMode = !isSearchMode && azFilter !== null;

  useEffect(() => {
    let cancelled = false;

    async function loadLookupPrintData() {
      setLoading(true);
      setError(null);

      try {
        if (trimmedSearch) {
          const [customerResult, orderResult] = await Promise.all([
            customersApi.list({ search: trimmedSearch, pageSize: 20 }),
            ordersApi.list({ search: trimmedSearch, pageSize: 20 }),
          ]);

          const customerOrderResults = await Promise.all(
            customerResult.items.map(async (customer) => {
              try {
                const result = await ordersApi.list({ customerId: customer.id, pageSize: 50 });
                return result.items;
              } catch {
                return [];
              }
            }),
          );

          const nextOrders = dedupeOrders([
            ...orderResult.items,
            ...customerOrderResults.flat(),
          ]);

          const customerMap = await buildCustomersById(nextOrders, customerResult.items);

          if (!cancelled) {
            setOrders(nextOrders);
            setCustomersById(customerMap);
          }

          return;
        }

        if (azFilter) {
          const allCustomers = await loadAllCustomersForLetterFilter();
          const matchingCustomers = allCustomers.filter((customer) => matchesLookupPrintLetterFilter(customer, azFilter));

          if (matchingCustomers.length === 0) {
            if (!cancelled) {
              setOrders([]);
              setCustomersById(new Map());
            }
            return;
          }

          const customerOrderResults = await Promise.all(
            matchingCustomers.map(async (customer) => {
              try {
                const result = await ordersApi.list({ customerId: customer.id, pageSize: LETTER_FILTER_ORDER_PAGE_SIZE });
                return result.items;
              } catch {
                return [];
              }
            }),
          );

          const nextOrders = dedupeOrders(customerOrderResults.flat());
          const customerMap = await buildCustomersById(nextOrders, matchingCustomers);

          if (!cancelled) {
            setOrders(nextOrders);
            setCustomersById(customerMap);
          }

          return;
        }

        const activeOrderResults = await Promise.all(
          RECENT_ORDER_STATUSES.map((status) => ordersApi.list({ status, pageSize: RECENT_ORDER_LIMIT })),
        );

        const nextOrders = dedupeOrders(activeOrderResults.flatMap((result) => result.items))
          .sort(sortOrdersNewestFirst)
          .slice(0, RECENT_ORDER_LIMIT);

        const customerMap = await buildCustomersById(nextOrders);

        if (!cancelled) {
          setOrders(nextOrders);
          setCustomersById(customerMap);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load lookup station');
          setOrders([]);
          setCustomersById(new Map());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLookupPrintData();
    return () => {
      cancelled = true;
    };
  }, [azFilter, trimmedSearch]);

  const rows = useMemo(() => {
    if (isSearchMode) {
      return buildLookupPrintRows(trimmedSearch, orders, customersById);
    }

    if (isLetterMode) {
      return buildLookupPrintLetterRows(orders, customersById);
    }

    return buildLookupPrintRecentRows(orders, customersById, RECENT_ORDER_LIMIT);
  }, [customersById, isLetterMode, isSearchMode, orders, trimmedSearch]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setAzFilter(null);
  }

  function handleLetterSelect(letter: string | null) {
    setAzFilter(letter);
    setSearch('');
  }

  function openPrintWindow(url: string) {
    const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      setError('Allow pop-ups for this site so print previews can open.');
    }
  }

  return (
    <div className="space-y-4">
      {kioskProfile !== 'lookup-print' && <BackToStationHomeButton />}

      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Lookup & Print Station</h1>
        <p className="text-sm text-gray-600">
          Tap a letter for quick browsing, or search by customer name, order number, or pickup code.
        </p>
      </div>

      <AzTabs selected={azFilter} onSelect={handleLetterSelect} />

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        placeholder="Search by customer, order #, or pickup code..."
        debounceMs={250}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner message={isSearchMode ? 'Searching orders...' : isLetterMode ? 'Loading letter results...' : 'Loading recent paperwork...'} />
      ) : rows.length === 0 ? (
        isSearchMode ? (
          <EmptyState
            title="No matching order"
            description="Stay on this station, double-check the name or pickup code, and try the search again."
          />
        ) : isLetterMode ? (
          <EmptyState
            title="No orders under this letter"
            description="Try a different letter or search by customer name, pickup code, or order number."
          />
        ) : (
          <EmptyState
            title="No active paperwork ready"
            description="Search by customer name, pickup code, or order number to find older paperwork."
          />
        )
      ) : (
        <div className="space-y-3">
          {isLetterMode ? (
            <div className="rounded-lg border border-hawk-200 bg-gradient-to-r from-hawk-50 to-gold-50 px-4 py-3 text-sm text-hawk-900">
              <h2 className="font-semibold">{getLetterFilterTitle(azFilter!)}</h2>
              <p className="mt-1">Showing printable orders for the selected letter group. Use direct search when you know the exact name or code.</p>
            </div>
          ) : !isSearchMode && (
            <div className="rounded-lg border border-gold-200 bg-gradient-to-r from-gold-50 to-hawk-50 px-4 py-3 text-sm text-hawk-900">
              <h2 className="font-semibold">Recent active orders</h2>
              <p className="mt-1">The newest open and in-progress paperwork is ready below. Use search or the letter tabs for anything else.</p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Pickup Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.orderId} className="align-top">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">#{row.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.customerName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{row.pickupCode ?? '--'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.sellerName ?? '--'}</td>
                    <td className="px-4 py-3 text-sm"><StatusChip status={row.status} hasIssue={false} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-hawk-600 px-3 py-2 text-sm font-medium text-white hover:bg-hawk-700"
                          onClick={() => openPrintWindow(buildPrintOrderPath(row.orderId, '/lookup-print'))}
                        >
                          Print Order Sheet
                        </button>
                        {row.canPrintSellerPacket && row.sellerId && (
                          <button
                            type="button"
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            onClick={() => openPrintWindow(buildPrintSellerPacketPath(row.sellerId!, '/lookup-print'))}
                          >
                            Print Seller Packet
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

