import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { resolveBestMatch, type MatchOption, normalizeScanInput } from './globalQuickFindMatch.js';

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

    if (!normalized) {
      setOptions([]);
      setNoMatch(false);
      return;
    }

    setLoading(true);
    setOptions([]);
    setNoMatch(false);

    try {
      const decision = await resolveBestMatch(query, {
        listOrders: ordersApi.list,
        listCustomers: customersApi.list,
      });

      if (decision.type === 'navigate') {
        navigate(`/pickup/${decision.orderId}`);
        return;
      }

      if (decision.type === 'options') {
        setOptions(decision.options);
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
                  key={option.order.id}
                  type="button"
                  className="w-full rounded-md border border-gray-300 p-4 text-left hover:bg-gray-50"
                  onClick={() => navigate(`/pickup/${option.order.id}`)}
                >
                  <p className="text-lg font-bold text-gray-900">Order #{option.order.orderNumber}</p>
                  <p className="text-sm text-gray-700">
                    {option.customer?.displayName ?? option.order.customerDisplayName ?? 'Customer unavailable'}
                  </p>
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
