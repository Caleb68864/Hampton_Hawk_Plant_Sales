import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersApi } from '@/api/orders.js';
import { customersApi } from '@/api/customers.js';
import { sellersApi } from '@/api/sellers.js';
import { plantsApi } from '@/api/plants.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { Customer } from '@/types/customer.js';
import type { Seller } from '@/types/seller.js';
import type { Plant } from '@/types/plant.js';
import type { CreateOrderLineRequest, Order, UpdateOrderRequest } from '@/types/order.js';

interface LineItem {
  lineId?: string;
  plantCatalogId: string;
  plantName: string;
  qtyOrdered: number;
  qtyFulfilled: number;
  notes: string;
}

export function NewOrderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(isEditing);
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerResults, setSellerResults] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);

  const [lines, setLines] = useState<LineItem[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantResults, setPlantResults] = useState<Plant[]>([]);

  useEffect(() => {
    if (!isEditing || !id) {
      return;
    }

    let cancelled = false;
    setLoadingOrder(true);
    setError(null);

    ordersApi
      .getById(id)
      .then(async (order) => {
        const [customer, seller] = await Promise.all([
          customersApi.getById(order.customerId),
          order.sellerId ? sellersApi.getById(order.sellerId) : Promise.resolve(null),
        ]);

        if (cancelled) {
          return;
        }

        setOriginalOrder(order);
        setSelectedCustomer(customer);
        setSelectedSeller(seller);
        setLines(order.lines.map((line) => ({
          lineId: line.id,
          plantCatalogId: line.plantCatalogId,
          plantName: line.plantName,
          qtyOrdered: line.qtyOrdered,
          qtyFulfilled: line.qtyFulfilled,
          notes: line.notes ?? '',
        })));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load order');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOrder(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await customersApi.list({ search: customerSearch, pageSize: 5 });
        setCustomerResults(r.items);
      } catch {
        setCustomerResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  useEffect(() => {
    if (!sellerSearch.trim() || selectedSeller) {
      setSellerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await sellersApi.list({ search: sellerSearch, pageSize: 5 });
        setSellerResults(r.items);
      } catch {
        setSellerResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sellerSearch, selectedSeller]);

  useEffect(() => {
    if (!plantSearch.trim()) {
      setPlantResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const r = await plantsApi.list({ search: plantSearch, pageSize: 10, activeOnly: true });
        setPlantResults(r.items);
      } catch {
        setPlantResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [plantSearch]);

  function addLine(plant: Plant) {
    setLines((prev) => {
      const existing = prev.find((line) => line.plantCatalogId === plant.id);
      if (existing) {
        return prev.map((line) => (
          line.plantCatalogId === plant.id
            ? { ...line, qtyOrdered: line.qtyOrdered + 1 }
            : line
        ));
      }

      return [
        ...prev,
        {
          plantCatalogId: plant.id,
          plantName: plant.name,
          qtyOrdered: 1,
          qtyFulfilled: 0,
          notes: '',
        },
      ];
    });

    setPlantSearch('');
    setPlantResults([]);
  }

  function updateLineQty(idx: number, qty: number) {
    setLines((prev) => prev.map((line, i) => {
      if (i !== idx) {
        return line;
      }

      const minimumQty = Math.max(1, line.qtyFulfilled);
      return {
        ...line,
        qtyOrdered: Math.max(minimumQty, qty),
      };
    }));
  }

  function removeLine(idx: number) {
    const line = lines[idx];
    if (!line) {
      return;
    }

    if (line.qtyFulfilled > 0) {
      setError('Cannot remove a line that has already been fulfilled.');
      return;
    }

    setLines((prev) => prev.filter((_, i) => i !== idx));
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
    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }
    if (lines.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing && id && originalOrder) {
        const updateRequest: UpdateOrderRequest = {
          customerId: selectedCustomer.id,
          sellerId: selectedSeller?.id ?? null,
          status: originalOrder.status,
          isWalkUp: originalOrder.isWalkUp,
          hasIssue: originalOrder.hasIssue,
        };

        await ordersApi.update(id, updateRequest);

        const originalLinesById = new Map(originalOrder.lines.map((line) => [line.id, line]));
        const retainedLineIds = new Set(lines.flatMap((line) => (line.lineId ? [line.lineId] : [])));

        for (const originalLine of originalOrder.lines) {
          if (!retainedLineIds.has(originalLine.id)) {
            await ordersApi.deleteLine(id, originalLine.id);
          }
        }

        for (const line of lines) {
          if (!line.lineId) {
            await ordersApi.addLine(id, {
              plantCatalogId: line.plantCatalogId,
              qtyOrdered: line.qtyOrdered,
              notes: line.notes || null,
            });
            continue;
          }

          const originalLine = originalLinesById.get(line.lineId);
          if (!originalLine) {
            continue;
          }

          const notesChanged = (originalLine.notes ?? '') !== line.notes;
          const quantityChanged = originalLine.qtyOrdered !== line.qtyOrdered;
          if (!notesChanged && !quantityChanged) {
            continue;
          }

          await ordersApi.updateLine(id, line.lineId, {
            qtyOrdered: line.qtyOrdered,
            notes: line.notes || null,
          });
        }

        navigate(`/orders/${id}`, { replace: true });
        return;
      }

      const orderLines: CreateOrderLineRequest[] = lines.map((line) => ({
        plantCatalogId: line.plantCatalogId,
        qtyOrdered: line.qtyOrdered,
        notes: line.notes || null,
      }));
      const order = await ordersApi.create({
        customerId: selectedCustomer.id,
        sellerId: selectedSeller?.id ?? null,
        lines: orderLines,
      });
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${isEditing ? 'save' : 'create'} order`);
    } finally {
      setSaving(false);
    }
  }

  if (loadingOrder) {
    return <LoadingSpinner message="Loading order..." />;
  }

  return (
    <JoyPageShell
      title={isEditing ? 'Edit Order' : 'New Order'}
      eyebrow={isEditing ? 'Order' : 'Create'}
      actions={
        <TouchButton variant="ghost" onClick={() => navigate(isEditing && id ? `/orders/${id}` : '/orders')}>
          {isEditing ? 'Back to Order' : 'Back to Orders'}
        </TouchButton>
      }
    >
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  {customerResults.map((customer) => (
                    <button key={customer.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setSelectedCustomer(customer); setCustomerSearch(''); setCustomerResults([]); }}>
                      {customer.displayName} {customer.pickupCode && <span className="text-gray-400">({customer.pickupCode})</span>}
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
                    <button type="button" className="px-3 py-2 text-sm text-gray-500" onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

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
                  {sellerResults.map((seller) => (
                    <button key={seller.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setSelectedSeller(seller); setSellerSearch(''); setSellerResults([]); }}>
                      {seller.displayName} {seller.grade && <span className="text-gray-400">(Grade {seller.grade})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
                {plantResults.map((plant) => (
                  <button key={plant.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between" onClick={() => addLine(plant)}>
                    <span>{plant.name} {plant.variant && <span className="text-gray-400">({plant.variant})</span>}</span>
                    <span className="text-gray-400">{plant.sku} {plant.price != null && `- $${plant.price.toFixed(2)}`}</span>
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fulfilled</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lines.map((line, idx) => (
                  <tr key={line.lineId ?? `${line.plantCatalogId}-${idx}`}>
                    <td className="px-4 py-2 text-sm text-gray-900">{line.plantName}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={Math.max(1, line.qtyFulfilled)}
                        className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-right"
                        value={line.qtyOrdered}
                        onChange={(e) => updateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{line.qtyFulfilled}</td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="Notes"
                        value={line.notes}
                        onChange={(e) => setLines((prev) => prev.map((item, itemIdx) => itemIdx === idx ? { ...item, notes: e.target.value } : item))}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
                        onClick={() => removeLine(idx)}
                        disabled={line.qtyFulfilled > 0}
                      >
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
          <TouchButton
            type="submit"
            variant="primary"
            disabled={saving || !selectedCustomer || lines.length === 0}
          >
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Order')}
          </TouchButton>
        </div>
      </form>
    </JoyPageShell>
  );
}
