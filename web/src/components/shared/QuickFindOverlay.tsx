import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts.js';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setResults({ customers: [], orders: [], plants: [], sellers: [] });
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
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [custResult, orderResult, plantResult, sellerResult] = await Promise.allSettled([
          customersApi.list({ search: query, pageSize: 5 }),
          ordersApi.list({ search: query, pageSize: 5 }),
          plantsApi.list({ search: query, pageSize: 5 }),
          sellersApi.list({ search: query, pageSize: 5 }),
        ]);
        setResults({
          customers: custResult.status === 'fulfilled' ? custResult.value.items : [],
          orders: orderResult.status === 'fulfilled' ? orderResult.value.items : [],
          plants: plantResult.status === 'fulfilled' ? plantResult.value.items : [],
          sellers: sellerResult.status === 'fulfilled' ? sellerResult.value.items : [],
        });
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const hasResults =
    results.customers.length > 0 ||
    results.orders.length > 0 ||
    results.plants.length > 0 ||
    results.sellers.length > 0;

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
            onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
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
              {results.customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  onClick={() => { navigate(`/customers/${c.id}`); close(); }}
                >
                  {c.displayName} {c.pickupCode && <span className="text-gray-400">({c.pickupCode})</span>}
                </button>
              ))}
            </div>
          )}
          {results.orders.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Orders</p>
              {results.orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  onClick={() => { navigate(`/orders/${o.id}`); close(); }}
                >
                  {o.orderNumber} - {o.customerDisplayName}
                </button>
              ))}
            </div>
          )}
          {results.plants.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Plants</p>
              {results.plants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  onClick={() => {
                    navigate(`/plants/${plant.id}`);
                    close();
                  }}
                >
                  {plant.name} <span className="text-gray-400">({plant.sku})</span>
                </button>
              ))}
            </div>
          )}
          {results.sellers.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">Sellers</p>
              {results.sellers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                  onClick={() => { navigate(`/sellers/${s.id}`); close(); }}
                >
                  {s.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
