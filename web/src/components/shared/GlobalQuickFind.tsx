import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { plantsApi } from '@/api/plants.js';
import type { Customer } from '@/types/customer.js';
import type { Plant } from '@/types/plant.js';

interface OrderMatchOption {
  kind: 'order';
  id: string;
  title: string;
  subtitle: string;
  reason: string;
}

interface PlantMatchOption {
  kind: 'plant';
  id: string;
  title: string;
  subtitle: string;
  reason: string;
}

type MatchOption = OrderMatchOption | PlantMatchOption;

function normalizeScanInput(value: string) {
  return value
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/#+$/g, '');
}

function normalizeKey(value: string) {
  return normalizeScanInput(value).toUpperCase();
}

function customerScore(customer: Customer, query: string) {
  const display = (customer.displayName ?? '').toUpperCase();
  const compactQuery = query.replace(/\s+/g, ' ').trim();
  if (display === compactQuery) return 3;
  if (display.startsWith(compactQuery)) return 2;
  if (display.includes(compactQuery)) return 1;
  return 0;
}

function plantScore(plant: Plant, query: string) {
  const normalizedName = (plant.name ?? '').toUpperCase().trim();
  const normalizedSku = (plant.sku ?? '').toUpperCase().trim();
  const normalizedBarcode = (plant.barcode ?? '').toUpperCase().trim();
  const compactQuery = query.replace(/\s+/g, ' ').trim();

  if (!compactQuery) return 0;
  if (normalizedSku === compactQuery || normalizedBarcode === compactQuery || normalizedName === compactQuery) return 5;
  if (normalizedSku.startsWith(compactQuery) || normalizedBarcode.startsWith(compactQuery)) return 4;
  if (normalizedName.startsWith(compactQuery)) return 3;
  if (normalizedName.includes(compactQuery)) return 2;
  if (normalizedSku.includes(compactQuery) || normalizedBarcode.includes(compactQuery)) return 1;
  return 0;
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
  const [options, setOptions] = useState<MatchOption[]>([]);
  const [noMatch, setNoMatch] = useState(false);
  const navigate = useNavigate();

  const adminPhone = useMemo(() => (import.meta.env.VITE_ADMIN_PHONE as string | undefined)?.trim() ?? '', []);

  async function routeBestMatch() {
    const normalized = normalizeScanInput(query);
    const normalizedKey = normalizeKey(query);

    if (!normalized) {
      setOptions([]);
      setNoMatch(false);
      return;
    }

    setLoading(true);
    setOptions([]);
    setNoMatch(false);

    try {
      const [orderRes, customerRes, plantRes] = await Promise.all([
        ordersApi.list({ search: normalized, pageSize: 25 }),
        customersApi.list({ search: normalized, pageSize: 25 }),
        plantsApi.list({ search: normalized, pageSize: 25 }),
      ]);

      const exactOrder = orderRes.items.find((o) => normalizeKey(o.orderNumber) === normalizedKey);
      if (exactOrder) {
        navigate(`/pickup/${exactOrder.id}`);
        return;
      }

      const exactPickupCustomers = customerRes.items.filter(
        (c) => normalizeKey(c.pickupCode ?? '') === normalizedKey,
      );

      if (exactPickupCustomers.length > 0) {
        const pickupOrders = orderRes.items.filter((o) =>
          exactPickupCustomers.some((c) => c.id === o.customerId),
        );

        if (pickupOrders.length === 1) {
          navigate(`/pickup/${pickupOrders[0].id}`);
          return;
        }

        if (pickupOrders.length > 1) {
          setOptions(
            pickupOrders.map((order) => ({
              kind: 'order',
              id: order.id,
              title: order.orderNumber,
              subtitle: order.customerDisplayName,
              reason: 'Exact pickup code match',
            })),
          );
          return;
        }
      }

      const rankedCustomer = customerRes.items
        .map((customer) => ({ customer, score: customerScore(customer, normalizedKey) }))
        .sort((a, b) => b.score - a.score)[0];

      if (rankedCustomer && rankedCustomer.score > 0) {
        const customerOrders = orderRes.items.filter((o) => o.customerId === rankedCustomer.customer.id);
        if (customerOrders.length === 1) {
          navigate(`/pickup/${customerOrders[0].id}`);
          return;
        }

        if (customerOrders.length > 1) {
          setOptions(
            customerOrders.map((order) => ({
              kind: 'order',
              id: order.id,
              title: order.orderNumber,
              subtitle: order.customerDisplayName,
              reason: 'Closest customer name match',
            })),
          );
          return;
        }
      }

      const exactPlant = plantRes.items.find((plant) => {
        const sku = normalizeKey(plant.sku);
        const barcode = normalizeKey(plant.barcode);
        const name = normalizeKey(plant.name);
        return sku === normalizedKey || barcode === normalizedKey || name === normalizedKey;
      });

      if (exactPlant) {
        navigate(`/plants/${exactPlant.id}`);
        return;
      }

      const rankedPlants = plantRes.items
        .map((plant) => ({ plant, score: plantScore(plant, normalizedKey) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);

      if (rankedPlants.length === 1 && rankedPlants[0].score >= 4) {
        navigate(`/plants/${rankedPlants[0].plant.id}`);
        return;
      }

      if (rankedPlants.length > 1) {
        setOptions(
          rankedPlants.slice(0, 6).map(({ plant, score }) => ({
            kind: 'plant',
            id: plant.id,
            title: `${plant.name} (${plant.sku})`,
            subtitle: `Barcode ${plant.barcode}`,
            reason: score >= 4 ? 'Strong plant match' : 'Possible plant match',
          })),
        );
        return;
      }

      if (orderRes.items.length > 1) {
        setOptions(
          orderRes.items.map((order) => ({
            kind: 'order',
            id: order.id,
            title: order.orderNumber,
            subtitle: order.customerDisplayName,
            reason: 'Possible match',
          })),
        );
        return;
      }

      setNoMatch(true);
    } catch {
      setNoMatch(true);
    } finally {
      setLoading(false);
    }
  }

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
          setNoMatch(false);
          setOptions([]);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void routeBestMatch();
          }
        }}
      />

      {(loading || options.length > 0 || noMatch) && (
        <div className="mt-3 rounded-md bg-white p-3 shadow-lg">
          {loading && <p className="text-sm text-gray-500">Looking up order...</p>}

          {!loading && options.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-gray-500">Tap a match</p>
              {options.map((option) => (
                <button
                  key={`${option.kind}-${option.id}`}
                  type="button"
                  className="w-full rounded-md border border-gray-300 p-4 text-left hover:bg-gray-50"
                  onClick={() => navigate(option.kind === 'plant' ? `/plants/${option.id}` : `/pickup/${option.id}`)}
                >
                  <p className="text-lg font-bold text-gray-900">{option.title}</p>
                  <p className="text-sm text-gray-700">{option.subtitle}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">{option.reason}</p>
                </button>
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
