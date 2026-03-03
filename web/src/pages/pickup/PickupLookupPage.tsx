import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { EmptyState } from '@/components/shared/EmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

interface CustomerWithOrders {
  customer: Customer;
  orders: Order[];
}

export function PickupLookupPage() {
  const navigate = useNavigate();
  const [azFilter, setAzFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CustomerWithOrders[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Search customers
      const params: Record<string, unknown> = { pageSize: 50 };
      if (search) params.search = search;
      if (azFilter) params.sortBy = 'lastName';

      const customerResult = await customersApi.list(params);
      let customers = customerResult.items;

      // Filter by A-Z tab (last name starts with letter)
      if (azFilter) {
        if (azFilter === '#') {
          customers = customers.filter(
            (c) => c.lastName && !/^[A-Za-z]/.test(c.lastName),
          );
        } else {
          customers = customers.filter(
            (c) =>
              c.lastName &&
              c.lastName.toUpperCase().startsWith(azFilter),
          );
        }
      }

      // Fetch orders for each customer
      const withOrders: CustomerWithOrders[] = await Promise.all(
        customers.map(async (customer) => {
          try {
            const orderResult = await ordersApi.list({
              customerId: customer.id,
              pageSize: 50,
            });
            return { customer, orders: orderResult.items };
          } catch {
            return { customer, orders: [] };
          }
        }),
      );

      // If search looks like an order number or pickup code, also search orders directly
      if (search && search.length >= 2) {
        try {
          const orderResult = await ordersApi.list({ search, pageSize: 20 });
          for (const order of orderResult.items) {
            const exists = withOrders.some((wo) =>
              wo.orders.some((o) => o.id === order.id),
            );
            if (!exists) {
              // Find or create customer entry
              const existing = withOrders.find(
                (wo) => wo.customer.id === order.customerId,
              );
              if (existing) {
                existing.orders.push(order);
              } else {
                try {
                  const customer = await customersApi.getById(order.customerId);
                  withOrders.push({ customer, orders: [order] });
                } catch {
                  // skip if can't fetch customer
                }
              }
            }
          }
        } catch {
          // order search may fail, that's okay
        }
      }

      setResults(withOrders.filter((wo) => wo.orders.length > 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search');
    } finally {
      setLoading(false);
    }
  }, [search, azFilter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Pickup</h1>

      <AzTabs selected={azFilter} onSelect={setAzFilter} />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, order #, or pickup code..."
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <LoadingSpinner message="Searching..." />
      ) : results.length === 0 ? (
        <EmptyState
          title="No results found"
          description="Try a different search term or letter filter."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pickup Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((row) =>
                row.orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/pickup/${order.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {row.customer.displayName}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {row.customer.pickupCode}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={order.status} hasIssue={order.hasIssue} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm text-hawk-600 hover:text-hawk-800 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pickup/${order.id}`);
                        }}
                      >
                        Scan
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
