import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { sellersApi } from '@/api/sellers.js';
import { plantsApi } from '@/api/plants.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import type { Customer } from '@/types/customer.js';
import type { Seller } from '@/types/seller.js';
import type { Plant } from '@/types/plant.js';
import type { CreateOrderLineRequest } from '@/types/order.js';

interface LineItem {
  plantCatalogId: string;
  plantName: string;
  qtyOrdered: number;
  notes: string;
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  // Seller
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerResults, setSellerResults] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  // Lines
  const [lines, setLines] = useState<LineItem[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantResults, setPlantResults] = useState<Plant[]>([]);

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await customersApi.list({ search: customerSearch, pageSize: 5 });
        setCustomerResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  // Seller search
  useEffect(() => {
    if (!sellerSearch.trim() || selectedSeller) { setSellerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await sellersApi.list({ search: sellerSearch, pageSize: 5 });
        setSellerResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [sellerSearch, selectedSeller]);

  // Plant search
  useEffect(() => {
    if (!plantSearch.trim()) { setPlantResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await plantsApi.list({ search: plantSearch, pageSize: 10, activeOnly: true });
        setPlantResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [plantSearch]);

  function addLine(plant: Plant) {
    const existing = lines.find((l) => l.plantCatalogId === plant.id);
    if (existing) {
      setLines(lines.map((l) => l.plantCatalogId === plant.id ? { ...l, qtyOrdered: l.qtyOrdered + 1 } : l));
    } else {
      setLines([...lines, { plantCatalogId: plant.id, plantName: plant.name, qtyOrdered: 1, notes: '' }]);
    }
    setPlantSearch('');
    setPlantResults([]);
  }

  function updateLineQty(idx: number, qty: number) {
    setLines(lines.map((l, i) => i === idx ? { ...l, qtyOrdered: Math.max(1, qty) } : l));
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  async function handleCreateCustomer() {
    if (!newCustomerName.trim()) return;
    setError(null);
    try {
      const created = await customersApi.create({ displayName: newCustomerName.trim() });
      setSelectedCustomer(created);
      setShowNewCustomer(false);
      setNewCustomerName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) { setError('Please select a customer'); return; }
    if (lines.length === 0) { setError('Please add at least one line item'); return; }
    setSaving(true);
    setError(null);
    try {
      const orderLines: CreateOrderLineRequest[] = lines.map((l) => ({
        plantCatalogId: l.plantCatalogId,
        qtyOrdered: l.qtyOrdered,
        notes: l.notes || null,
      }));
      const order = await ordersApi.create({
        customerId: selectedCustomer.id,
        sellerId: selectedSeller?.id ?? null,
        lines: orderLines,
      });
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">New Order</h1>
        <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate('/orders')}>
          Back to Orders
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Customer *</h2>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-hawk-50 border border-hawk-200 rounded-md p-3">
              <div>
                <p className="text-sm font-medium text-hawk-900">{selectedCustomer.displayName}</p>
                {selectedCustomer.pickupCode && <p className="text-xs text-hawk-700">Pickup: {selectedCustomer.pickupCode}</p>}
              </div>
              <button type="button" className="text-sm text-hawk-600 hover:text-hawk-700" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerResults.length > 0 && (
                <div className="border border-gray-200 rounded-md divide-y">
                  {customerResults.map((c) => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}>
                      {c.displayName} {c.pickupCode && <span className="text-gray-400">({c.pickupCode})</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {!showNewCustomer ? (
                  <button type="button" className="text-sm text-blue-600 hover:text-blue-700" onClick={() => setShowNewCustomer(true)}>
                    + Create New Customer
                  </button>
                ) : (
                  <>
                    <input
                      type="text"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="New customer display name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      autoFocus
                    />
                    <button type="button" className="px-3 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700" onClick={handleCreateCustomer}>Create</button>
                    <button type="button" className="px-3 py-2 text-sm text-gray-500" onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); }}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Seller Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Seller (optional)</h2>
          {selectedSeller ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm font-medium text-blue-900">{selectedSeller.displayName}</p>
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700" onClick={() => { setSelectedSeller(null); setSellerSearch(''); }}>
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                placeholder="Search sellers..."
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
              />
              {sellerResults.length > 0 && (
                <div className="border border-gray-200 rounded-md divide-y">
                  {sellerResults.map((s) => (
                    <button key={s.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setSelectedSeller(s); setSellerSearch(''); setSellerResults([]); }}>
                      {s.displayName} {s.grade && <span className="text-gray-400">(Grade {s.grade})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Line Items *</h2>

          <div className="space-y-2 mb-4">
            <input
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              placeholder="Search plants to add..."
              value={plantSearch}
              onChange={(e) => setPlantSearch(e.target.value)}
            />
            {plantResults.length > 0 && (
              <div className="border border-gray-200 rounded-md divide-y max-h-48 overflow-y-auto">
                {plantResults.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between" onClick={() => addLine(p)}>
                    <span>{p.name} {p.variant && <span className="text-gray-400">({p.variant})</span>}</span>
                    <span className="text-gray-400">{p.sku} {p.price != null && `- $${p.price.toFixed(2)}`}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line, idx) => (
                  <tr key={line.plantCatalogId}>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.plantName}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                        value={line.qtyOrdered}
                        onChange={(e) => updateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="Notes"
                        value={line.notes}
                        onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, notes: e.target.value } : l))}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeLine(idx)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Search and add plants above</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !selectedCustomer || lines.length === 0}
            className="px-6 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
