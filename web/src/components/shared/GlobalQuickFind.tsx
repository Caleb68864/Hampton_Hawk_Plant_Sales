import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { plantsApi } from '@/api/plants.js';
import { sellersApi } from '@/api/sellers.js';

interface QuickFindResult {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  group: 'Customers' | 'Orders' | 'Plants' | 'Sellers';
}

function printBlankTicket() {
  const win = window.open('', '_blank');
  if (!win) return;

  win.document.open();
  win.document.write(`
    <html>
      <head>
        <title>Blank Pickup Ticket</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin-bottom: 24px; }
          .line { border-bottom: 1px solid #111; margin-bottom: 18px; height: 24px; }
          .label { font-size: 12px; color: #555; margin-bottom: 4px; }
        </style>
        <script>
          window.addEventListener('load', () => {
            window.print();
          });
        </script>
      </head>
      <body>
        <h1>Hampton Hawks - Blank Pickup Ticket</h1>
        <div class="label">Customer Name</div><div class="line"></div>
        <div class="label">Order #</div><div class="line"></div>
        <div class="label">Pickup Code</div><div class="line"></div>
        <div class="label">Phone</div><div class="line"></div>
        <div class="label">Notes</div><div class="line"></div><div class="line"></div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
}

export function GlobalQuickFind() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<QuickFindResult[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchTimeoutRef = useRef<number | undefined>(undefined);
  const navigate = useNavigate();

  const adminPhone = useMemo(() => (import.meta.env.VITE_ADMIN_PHONE as string | undefined)?.trim() ?? '', []);

  function clearResults() {
    setOptions([]);
    setNoMatch(false);
    setSelectedIndex(0);
  }

  function goToResult(route: string) {
    navigate(route);
    setQuery('');
    clearResults();
  }

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      clearResults();
      setLoading(false);
      return;
    }

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setLoading(true);
      setNoMatch(false);
      try {
        const [customerResult, orderResult, plantResult, sellerResult] = await Promise.allSettled([
          customersApi.list({ search: trimmedQuery, pageSize: 5 }),
          ordersApi.list({ search: trimmedQuery, pageSize: 5 }),
          plantsApi.list({ search: trimmedQuery, pageSize: 5 }),
          sellersApi.list({ search: trimmedQuery, pageSize: 5 }),
        ]);

        const nextOptions: QuickFindResult[] = [
          ...(customerResult.status === 'fulfilled'
            ? customerResult.value.items.map((customer) => ({
                id: customer.id,
                route: `/customers/${customer.id}`,
                title: customer.displayName,
                subtitle: customer.pickupCode ? `Pickup code: ${customer.pickupCode}` : customer.phone ?? 'Customer',
                group: 'Customers' as const,
              }))
            : []),
          ...(orderResult.status === 'fulfilled'
            ? orderResult.value.items.map((order) => ({
                id: order.id,
                route: `/orders/${order.id}`,
                title: `Order #${order.orderNumber}`,
                subtitle: order.customerDisplayName,
                group: 'Orders' as const,
              }))
            : []),
          ...(plantResult.status === 'fulfilled'
            ? plantResult.value.items.map((plant) => ({
                id: plant.id,
                route: `/plants/${plant.id}`,
                title: plant.name,
                subtitle: `${plant.sku} • ${plant.barcode}`,
                group: 'Plants' as const,
              }))
            : []),
          ...(sellerResult.status === 'fulfilled'
            ? sellerResult.value.items.map((seller) => ({
                id: seller.id,
                route: `/sellers/${seller.id}`,
                title: seller.displayName,
                subtitle: seller.teacher ?? seller.grade ?? 'Seller',
                group: 'Sellers' as const,
              }))
            : []),
        ];

        setOptions(nextOptions);
        setNoMatch(nextOptions.length === 0);
        setSelectedIndex(0);
      } catch {
        setOptions([]);
        setNoMatch(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  function handleEnter() {
    if (loading || !query.trim()) {
      return;
    }

    if (!options.length) {
      setOptions([]);
      setNoMatch(true);
      return;
    }

    const selected = options[Math.min(selectedIndex, options.length - 1)];
    if (selected) {
      goToResult(selected.route);
    }
  }

  const groupedOptions = useMemo(() => {
    const groups: Array<{ name: QuickFindResult['group']; items: Array<QuickFindResult & { index: number }> }> = [];
    const byGroup = new Map<QuickFindResult['group'], QuickFindResult[]>();

    options.forEach((option) => {
      const groupItems = byGroup.get(option.group) ?? [];
      groupItems.push(option);
      byGroup.set(option.group, groupItems);
    });

    let cursor = 0;
    (['Customers', 'Orders', 'Plants', 'Sellers'] as const).forEach((groupName) => {
      const groupItems = byGroup.get(groupName);
      if (!groupItems?.length) return;

      groups.push({
        name: groupName,
        items: groupItems.map((item) => {
          const indexedItem = { ...item, index: cursor };
          cursor += 1;
          return indexedItem;
        }),
      });
    });

    return groups;
  }, [options]);

  return (
    <div className="bg-hawk-600/60 px-4 pb-4">
      <label htmlFor="global-quick-find" className="block text-xs uppercase tracking-wide text-hawk-100 mb-1">
        Quick Find
      </label>
      <input
        id="global-quick-find"
        type="text"
        value={query}
        className="w-full rounded-md border border-white/40 bg-white px-3 py-3 text-lg font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-white"
        placeholder="Order #, pickup code, customer, plant SKU/barcode/name, phone"
        onChange={(e) => {
          setQuery(e.target.value);
          clearResults();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!options.length) return;
            setSelectedIndex((prev) => (prev + 1) % options.length);
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!options.length) return;
            setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
            return;
          }

          if (e.key === 'Enter') {
            e.preventDefault();
            handleEnter();
          }
        }}
      />

      {(loading || options.length > 0 || noMatch) && (
        <div className="mt-3 rounded-md bg-white p-3 shadow-lg">
          {loading && <p className="text-sm text-gray-500">Searching customers, orders, plants, sellers…</p>}

          {!loading && options.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-gray-500">↑ ↓ to pick • Enter to open</p>
              {groupedOptions.map((group) => (
                <div key={group.name} className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group.name}</p>
                  {group.items.map((option) => (
                    <button
                      key={`${option.group}-${option.id}`}
                      type="button"
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        selectedIndex === option.index
                          ? 'border-hawk-400 bg-hawk-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                      onMouseEnter={() => setSelectedIndex(option.index)}
                      onClick={() => goToResult(option.route)}
                    >
                      <p className="text-base font-bold text-gray-900">{option.title}</p>
                      <p className="text-sm text-gray-700">{option.subtitle}</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!loading && noMatch && (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-gray-800">No match found</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  className="rounded-md border border-hawk-300 bg-hawk-50 p-3 text-left text-sm font-medium text-hawk-800"
                  onClick={() => navigate('/walkup/new')}
                >
                  Create walk-up
                </button>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-gray-50 p-3 text-left text-sm font-medium text-gray-800"
                  onClick={printBlankTicket}
                >
                  Print blank ticket
                </button>
                {adminPhone ? (
                  <a
                    href={`tel:${adminPhone}`}
                    className="rounded-md border border-red-300 bg-red-50 p-3 text-left text-sm font-medium text-red-800"
                  >
                    Call admin
                  </a>
                ) : (
                  <button
                    type="button"
                    className="rounded-md border border-red-300 bg-red-50 p-3 text-left text-sm font-medium text-red-800"
                    onClick={() => window.alert('Call the admin using your posted station contact list.')}
                  >
                    Call admin
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
