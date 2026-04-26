import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { SearchBar } from '@/components/shared/SearchBar.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { BotanicalEmptyState } from '@/components/shared/BotanicalEmptyState.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { useAppStore } from '@/stores/appStore.js';
import { useKioskStore } from '@/stores/kioskStore.js';
import {
  findExactOrderNumberMatches,
  looksLikeOrderNumberLookup,
  normalizeOrderLookupValue,
} from '@/utils/orderLookup.js';
import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

interface CustomerWithOrders {
  customer: Customer;
  orders: Order[];
}

const NO_MATCH_MESSAGE = 'What happened: No order found for scanned barcode/order number.\nWhat to do next: Clear the field, rescan the sheet, or type the order number again.';

export function PickupLookupPage() {
  const navigate = useNavigate();
  const isPickupKiosk = useKioskStore((s) => s.session?.profile === 'pickup');
  const pickupSearchDebounceMs = useAppStore((s) => s.pickupSearchDebounceMs);
  const pickupAutoJumpMode = useAppStore((s) => s.pickupAutoJumpMode);
  const [azFilter, setAzFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CustomerWithOrders[]>([]);
  const [exactOrderMatches, setExactOrderMatches] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedSearch = normalizeOrderLookupValue(search);
  const orderLookupActive = looksLikeOrderNumberLookup(normalizedSearch);

  useEffect(() => {
    const refocus = () => searchInputRef.current?.focus();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refocus();
      }
    };

    refocus();
    window.addEventListener('focus', refocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      setLoading(true);
      setError(null);

      try {
        const params: Record<string, unknown> = { pageSize: 50 };
        const trimmedSearch = search.trim();
        if (trimmedSearch) {
          params.search = trimmedSearch;
        }
        if (azFilter) {
          params.sortBy = 'lastName';
        }

        const customerResult = await customersApi.list(params);
        let customers = customerResult.items;

        if (azFilter) {
          if (azFilter === '#') {
            customers = customers.filter((c) => c.lastName && !/^[A-Za-z]/.test(c.lastName));
          } else {
            customers = customers.filter((c) => c.lastName && c.lastName.toUpperCase().startsWith(azFilter));
          }
        }

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

        let directOrderMatches: Order[] = [];
        if (trimmedSearch.length >= 2) {
          try {
            const orderResult = await ordersApi.list({ search: trimmedSearch, pageSize: 50 });
            directOrderMatches = orderResult.items;

            for (const order of orderResult.items) {
              const existingCustomer = withOrders.find((row) => row.customer.id === order.customerId);
              if (existingCustomer) {
                if (!existingCustomer.orders.some((existingOrder) => existingOrder.id === order.id)) {
                  existingCustomer.orders.push(order);
                }
                continue;
              }

              try {
                const customer = await customersApi.getById(order.customerId);
                withOrders.push({ customer, orders: [order] });
              } catch {
                // Ignore customer fetch failures so the lookup table can still render other rows.
              }
            }
          } catch {
            // Direct order search is a convenience only; customer-based results may still render.
          }
        }

        const nextExactMatches = orderLookupActive
          ? findExactOrderNumberMatches(normalizedSearch, directOrderMatches)
          : [];

        if (cancelled) {
          return;
        }

        setExactOrderMatches(nextExactMatches);

        // SS-09: Auto-jump rules.
        // - ExactMatchOnly: jump only when the format heuristic recognizes the
        //   value as an order number AND we have exactly one exact match.
        // - BestMatchWhenSingle: bypass the format heuristic. If a direct order
        //   search returned exactly one row, jump to it. Falls back to the
        //   exact-match path when the heuristic does match.
        if (pickupAutoJumpMode === 'BestMatchWhenSingle') {
          if (orderLookupActive && nextExactMatches.length === 1) {
            navigate(`/pickup/${nextExactMatches[0].id}`);
            return;
          }
          if (
            !orderLookupActive &&
            trimmedSearch.length >= 2 &&
            directOrderMatches.length === 1
          ) {
            navigate(`/pickup/${directOrderMatches[0].id}`);
            return;
          }
        } else if (orderLookupActive && nextExactMatches.length === 1) {
          navigate(`/pickup/${nextExactMatches[0].id}`);
          return;
        }

        setResults(withOrders.filter((row) => row.orders.length > 0));
      } catch (e) {
        if (!cancelled) {
          setExactOrderMatches([]);
          setError(e instanceof Error ? e.message : 'Failed to search');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchResults();
    return () => {
      cancelled = true;
    };
  }, [azFilter, navigate, normalizedSearch, orderLookupActive, pickupAutoJumpMode, search]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (value.trim().length > 0 && azFilter) {
      setAzFilter(null);
    }
    if (!value.trim()) {
      setExactOrderMatches([]);
      setError(null);
    }
  }

  function clearLookup() {
    setSearch('');
    setAzFilter(null);
    setExactOrderMatches([]);
    setError(null);
    searchInputRef.current?.focus();
  }

  const showOrderLookupState = Boolean(search.trim()) && orderLookupActive;
  const showDuplicateResults = showOrderLookupState && exactOrderMatches.length > 1;
  const showNoExactMatch = showOrderLookupState && !loading && exactOrderMatches.length === 0 && !error;

  return (
    <div className="space-y-4">
      {!isPickupKiosk && <BackToStationHomeButton />}

      <div className="space-y-1">
        <SectionHeading level={1}>Pickup Station</SectionHeading>
        <p
          className="text-sm text-hawk-600"
          style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
        >
          Keep the cursor here and scan the order sheet barcode. You can still type a customer name, order number, or pickup code.
        </p>
      </div>

      <AzTabs selected={azFilter} onSelect={setAzFilter} />

      <SearchBar
        value={search}
        onChange={handleSearchChange}
        onEnter={handleSearchChange}
        placeholder="Scan order sheet barcode, or search by name, order #, or pickup code..."
        debounceMs={pickupSearchDebounceMs}
        autoFocus
        inputRef={searchInputRef}
      />

      {/* Gold-trim input shell */}
      <div
        className="relative rounded-2xl p-5"
        style={{
          background: 'linear-gradient(180deg, white 0%, var(--color-gold-50) 100%)',
          border: '2px solid var(--color-gold-300)',
        }}
      >
        {/* Dashed inner border */}
        <span
          className="absolute pointer-events-none"
          style={{
            inset: '5px',
            borderRadius: '12px',
            border: '1px dashed rgba(184, 129, 26, 0.45)',
          }}
        />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-hawk-900 mb-3">
            <div>
              <p
                className="font-semibold"
                style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
              >
                Scanner-ready search
              </p>
              <p
                className="text-hawk-700"
                style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}
              >
                Scan with the cursor in the box. Press Enter if your scanner does not do it automatically.
              </p>
            </div>
            <TouchButton variant="ghost" onClick={clearLookup}>
              Clear for Next Order
            </TouchButton>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {showOrderLookupState && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">Scanned / submitted order number</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-[0.2em] text-gray-900">{normalizedSearch}</p>
          {showDuplicateResults && (
            <p className="mt-2 text-sm text-amber-700">Multiple orders matched this order number. Choose the correct order below.</p>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message={showOrderLookupState ? 'Looking up order...' : 'Searching...'} />
      ) : showDuplicateResults ? (
        <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50">
          <table className="min-w-full divide-y divide-amber-200">
            <thead className="bg-amber-100/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-amber-900">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-amber-900">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-amber-900">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200 bg-white">
              {exactOrderMatches.map((order) => (
                <tr key={order.id} className="hover:bg-amber-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.customerDisplayName}</td>
                  <td className="px-4 py-3"><StatusChip status={order.status} hasIssue={order.hasIssue} /></td>
                  <td className="px-4 py-3 text-right">
                    <TouchButton
                      variant="primary"
                      className="text-sm px-4 py-2"
                      onClick={() => navigate(`/pickup/${order.id}`)}
                    >
                      Open Order
                    </TouchButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : showNoExactMatch ? (
        <div className="space-y-3">
          <ErrorBanner message={NO_MATCH_MESSAGE} />
          <BotanicalEmptyState
            title="No exact order match"
            description="Rescan the sheet, clear the field for the next customer, or type the order number manually."
          />
        </div>
      ) : results.length === 0 ? (
        <BotanicalEmptyState
          title="No results found"
          description={search ? 'Try a different search term or letter filter.' : 'Search by customer, order number, or pickup code to begin.'}
          action={
            search ? (
              <TouchButton variant="ghost" onClick={clearLookup}>
                Clear filters
              </TouchButton>
            ) : undefined
          }
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
