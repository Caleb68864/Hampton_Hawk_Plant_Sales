import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts.js';
import { normalizeScannedBarcode } from '@/utils/barcode.js';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { plantsApi } from '@/api/plants.js';
import { sellersApi } from '@/api/sellers.js';
import type { Customer } from '@/types/customer.js';
import type { Order } from '@/types/order.js';
import type { Plant } from '@/types/plant.js';
import type { Seller } from '@/types/seller.js';

interface SearchResults {
  customers: Customer[];
  orders: Order[];
  plants: Plant[];
  sellers: Seller[];
}

export function QuickFindOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ customers: [], orders: [], plants: [], sellers: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults({ customers: [], orders: [], plants: [], sellers: [] });
    setSelectedIndex(0);
  }, []);

  useKeyboardShortcut('k', 'ctrl', open);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ customers: [], orders: [], plants: [], sellers: [] });
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const trimmed = query.trim();
      const looksLikeBarcode = /^0*\d+$/.test(trimmed);
      const plantSearch = looksLikeBarcode ? normalizeScannedBarcode(trimmed) : query;
      try {
        const [custResult, orderResult, plantResult, sellerResult] = await Promise.allSettled([
          customersApi.list({ search: query, pageSize: 5 }),
          ordersApi.list({ search: query, pageSize: 5 }),
          plantsApi.list({ search: plantSearch, pageSize: 5 }),
          sellersApi.list({ search: query, pageSize: 5 }),
        ]);
        setResults({
          customers: custResult.status === 'fulfilled' ? custResult.value.items : [],
          orders: orderResult.status === 'fulfilled' ? orderResult.value.items : [],
          plants: plantResult.status === 'fulfilled' ? plantResult.value.items : [],
          sellers: sellerResult.status === 'fulfilled' ? sellerResult.value.items : [],
        });
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const navigationOptions = useMemo(
    () => [
      ...results.customers.map((c) => ({ key: `customer-${c.id}`, route: `/customers/${c.id}` })),
      ...results.orders.map((o) => ({ key: `order-${o.id}`, route: `/orders/${o.id}` })),
      ...results.plants.map((p) => ({ key: `plant-${p.id}`, route: `/plants/${p.id}` })),
      ...results.sellers.map((s) => ({ key: `seller-${s.id}`, route: `/sellers/${s.id}` })),
    ],
    [results],
  );

  function onSelect(route: string) {
    navigate(route);
    close();
  }

  if (!isOpen) return null;

  const hasResults = navigationOptions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50" onClick={close}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b">
          <input
            ref={inputRef}
            type="text"
            className="w-full text-lg outline-none placeholder-gray-400"
            placeholder="Search customers, orders, plants, sellers... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                close();
                return;
              }

              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!navigationOptions.length) return;
                setSelectedIndex((prev) => (prev + 1) % navigationOptions.length);
                return;
              }

              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!navigationOptions.length) return;
                setSelectedIndex((prev) => (prev - 1 + navigationOptions.length) % navigationOptions.length);
                return;
              }

              if (e.key === 'Enter') {
                e.preventDefault();
                const target = navigationOptions[selectedIndex];
                if (target) {
                  onSelect(target.route);
                }
              }
            }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-gray-500">Searching...</p>}
          {!loading && query && !hasResults && (
            <p className="p-4 text-sm text-gray-500">No results found.</p>
          )}
          {results.customers.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Customers</p>
              {results.customers.map((c, index) => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm rounded ${
                    selectedIndex === index ? 'bg-hawk-50' : 'hover:bg-gray-100'
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => { onSelect(`/customers/${c.id}`); }}
                >
                  {c.displayName} {c.pickupCode && <span className="text-gray-400">({c.pickupCode})</span>}
                </button>
              ))}
            </div>
          )}
          {results.orders.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Orders</p>
              {results.orders.map((o, index) => {
                const optionIndex = results.customers.length + index;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm rounded ${
                      selectedIndex === optionIndex ? 'bg-hawk-50' : 'hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setSelectedIndex(optionIndex)}
                    onClick={() => { onSelect(`/orders/${o.id}`); }}
                  >
                    {o.orderNumber} - {o.customerDisplayName}
                  </button>
                );
              })}
            </div>
          )}
          {results.plants.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Plants</p>
              {results.plants.map((plant, index) => {
                const optionIndex = results.customers.length + results.orders.length + index;
                return (
                  <button
                    key={plant.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm rounded ${
                      selectedIndex === optionIndex ? 'bg-hawk-50' : 'hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setSelectedIndex(optionIndex)}
                    onClick={() => {
                      onSelect(`/plants/${plant.id}`);
                    }}
                  >
                    {plant.name} <span className="text-gray-400">({plant.sku})</span>
                  </button>
                );
              })}
            </div>
          )}
          {results.sellers.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Sellers</p>
              {results.sellers.map((s, index) => {
                const optionIndex = results.customers.length + results.orders.length + results.plants.length + index;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm rounded ${
                      selectedIndex === optionIndex ? 'bg-hawk-50' : 'hover:bg-gray-100'
                    }`}
                    onMouseEnter={() => setSelectedIndex(optionIndex)}
                    onClick={() => { onSelect(`/sellers/${s.id}`); }}
                  >
                    {s.displayName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
