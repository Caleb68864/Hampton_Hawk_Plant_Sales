import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { walkupApi } from '@/api/walkup.js';
import type { WalkUpAvailability } from '@/api/walkup.js';
import { customersApi } from '@/api/customers.js';
import { plantsApi } from '@/api/plants.js';
import { AzTabs } from '@/components/shared/AzTabs.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { BackToStationHomeButton } from '@/components/shared/BackToStationHomeButton.js';
import { useAuthStore } from '@/stores/authStore.js';
import type { Customer } from '@/types/customer.js';
import type { Plant } from '@/types/plant.js';

type Step = 1 | 2 | 3;

interface WalkUpLineItem {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered: number;
  notes: string;
  availableForWalkup: number;
  overrideApproved: boolean;
  adminPin?: string;
  adminReason?: string;
}

function normalizeSearchText(value: string) {
  return value
    .replace(/[\r\n\t]/g, '')
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/#+$/g, '')
    .toUpperCase();
}

function normalizeCompact(value: string) {
  return normalizeSearchText(value).replace(/[^A-Z0-9]/g, '');
}

function scoreByFields(query: string, ...fields: string[]) {
  const compactQuery = normalizeCompact(query);
  if (!compactQuery) return 0;

  let best = 0;
  for (const field of fields) {
    const normalizedField = normalizeSearchText(field ?? '');
    const compactField = normalizeCompact(field ?? '');
    if (!normalizedField && !compactField) continue;

    if (normalizedField === query || compactField === compactQuery) best = Math.max(best, 120);
    else if (normalizedField.startsWith(query) || compactField.startsWith(compactQuery)) best = Math.max(best, 90);
    else if (normalizedField.includes(query) || compactField.includes(compactQuery)) best = Math.max(best, 60);
    else if (compactQuery.length >= 3 && compactField.includes(compactQuery.slice(0, 3))) best = Math.max(best, 30);
  }

  return best;
}

function scoreCustomerMatch(customer: Customer, query: string) {
  const boostedDisplay = scoreByFields(query, customer.displayName) + scoreByFields(query, customer.displayName);
  const fallback = scoreByFields(query, customer.phone ?? '', customer.email ?? '', customer.pickupCode ?? '');
  return Math.max(boostedDisplay, fallback);
}

function scorePlantMatch(plant: Plant, query: string) {
  const nameScore = scoreByFields(query, plant.name, plant.variant ?? '');
  const idScore = scoreByFields(query, plant.sku, plant.barcode);
  return Math.max(nameScore, idScore + 5);
}

function rankResults<T>(items: T[], score: (item: T) => number) {
  return items
    .map((item) => ({ item, score: score(item) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

export function WalkUpNewOrderPage() {
  const navigate = useNavigate();
  const openPinModal = useAuthStore((s) => s.openPinModal);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerAzFilter, setCustomerAzFilter] = useState<string | null>(null);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createInline, setCreateInline] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Line items
  const [lines, setLines] = useState<WalkUpLineItem[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantAzFilter, setPlantAzFilter] = useState<string | null>(null);
  const [plantResults, setPlantResults] = useState<Plant[]>([]);

  // Customer search
  useEffect(() => {
    if (selectedCustomer) { setCustomerResults([]); return; }

    const trimmedSearch = customerSearch.trim();
    const query = trimmedSearch || (customerAzFilter ? `${customerAzFilter}*` : '');
    if (!query) { setCustomerResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        const r = await customersApi.list({ search: query, pageSize: 20 });
        if (trimmedSearch) {
          const normalized = normalizeSearchText(trimmedSearch);
          setCustomerResults(rankResults(r.items, (customer) => scoreCustomerMatch(customer, normalized)));
          return;
        }
        setCustomerResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerAzFilter, selectedCustomer]);

  // Plant search
  useEffect(() => {
    const trimmedSearch = plantSearch.trim();
    const query = trimmedSearch || (plantAzFilter ? `${plantAzFilter}*` : '');
    if (!query) { setPlantResults([]); return; }

    const timer = setTimeout(async () => {
      try {
        const r = await plantsApi.list({ search: query, pageSize: 40, activeOnly: true });
        if (trimmedSearch) {
          const normalized = normalizeSearchText(trimmedSearch);
          setPlantResults(rankResults(r.items, (plant) => scorePlantMatch(plant, normalized)));
          return;
        }
        setPlantResults(r.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [plantSearch, plantAzFilter]);

  async function handleCreateCustomer() {
    if (!newDisplayName.trim()) return;
    setError(null);
    try {
      const created = await customersApi.create({
        displayName: newDisplayName.trim(),
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
      });
      setSelectedCustomer(created);
      setCreateInline(false);
      setNewDisplayName('');
      setNewPhone('');
      setNewEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create customer');
    }
  }

  async function addPlantLine(plant: Plant) {
    const existing = lines.find((l) => l.plantCatalogId === plant.id);
    if (existing) {
      setPlantSearch('');
      setPlantResults([]);
      return;
    }

    let availability: WalkUpAvailability | null = null;
    try {
      availability = await walkupApi.getAvailability(plant.id);
    } catch { /* ignore */ }

    setLines([
      ...lines,
      {
        plantCatalogId: plant.id,
        plantName: plant.name,
        plantSku: plant.sku,
        qtyOrdered: 1,
        notes: '',
        availableForWalkup: availability?.availableForWalkup ?? 0,
        overrideApproved: false,
      },
    ]);
    setPlantSearch('');
    setPlantResults([]);
  }

  function updateLineQty(idx: number, qty: number) {
    setLines(lines.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, qtyOrdered: Math.max(1, qty), overrideApproved: l.overrideApproved && qty <= l.availableForWalkup };
    }));
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  async function handleAdminOverride(idx: number) {
    const result = await openPinModal();
    if (!result) return;
    setLines(lines.map((l, i) =>
      i === idx ? { ...l, overrideApproved: true, adminPin: result.pin, adminReason: result.reason } : l,
    ));
  }

  function isLineValid(line: WalkUpLineItem) {
    return line.qtyOrdered <= line.availableForWalkup || line.overrideApproved;
  }

  const allLinesValid = lines.length > 0 && lines.every(isLineValid);

  async function handleSubmit() {
    if (!selectedCustomer && !newDisplayName.trim()) {
      setError('Please select or create a customer');
      return;
    }
    if (lines.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const order = await walkupApi.createOrder({
        displayName: selectedCustomer?.displayName ?? newDisplayName.trim(),
        phone: selectedCustomer?.phone ?? (newPhone.trim() || null),
        email: selectedCustomer?.email ?? (newEmail.trim() || null),
        customerId: selectedCustomer?.id ?? null,
      });

      for (const line of lines) {
        await walkupApi.addLine(
          order.id,
          {
            plantCatalogId: line.plantCatalogId,
            qtyOrdered: line.qtyOrdered,
            notes: line.notes || null,
          },
          line.adminPin,
          line.adminReason,
        );
      }

      navigate(`/orders/${order.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create walk-up order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <BackToStationHomeButton />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          New Walk-Up Order
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            Walk-Up
          </span>
        </h1>
        <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate('/station')}>
          Back to Station Home
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([1, 2, 3] as Step[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={s > step}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              s === step
                ? 'bg-hawk-600 text-white'
                : s < step
                  ? 'bg-hawk-100 text-hawk-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400'
            }`}
            onClick={() => { if (s < step) setStep(s); }}
          >
            {s}. {s === 1 ? 'Customer' : s === 2 ? 'Items' : 'Review'}
          </button>
        ))}
      </div>

      {/* Step 1: Customer */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Select or Create Customer</h2>

          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-hawk-50 border border-hawk-200 rounded-md p-3">
              <div>
                <p className="text-sm font-medium text-hawk-900">{selectedCustomer.displayName}</p>
                {selectedCustomer.phone && <p className="text-xs text-hawk-700">{selectedCustomer.phone}</p>}
              </div>
              <button type="button" className="text-sm text-hawk-600 hover:text-hawk-700" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <AzTabs
                selected={customerAzFilter}
                onSelect={(letter) => {
                  setCustomerAzFilter(letter === '#' ? null : letter);
                  setCustomerSearch('');
                }}
              />
              <input
                type="text"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                placeholder="Search existing customers..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerAzFilter(null);
                  setCustomerSearch(e.target.value);
                }}
              />
              {customerResults.length > 0 && (
                <div className="border border-gray-200 rounded-md divide-y">
                  {customerResults.map((c) => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setCustomerResults([]); }}>
                      {c.displayName} {c.phone && <span className="text-gray-400">({c.phone})</span>}
                    </button>
                  ))}
                </div>
              )}
              {customerResults.length === 0 && (customerSearch.trim() || customerAzFilter) && (
                <p className="text-xs text-gray-500">No customers yet. Try phone digits, pickup code, or first letter tabs.</p>
              )}

              {!createInline ? (
                <button type="button" className="text-sm text-blue-600 hover:text-blue-700" onClick={() => setCreateInline(true)}>
                  + Create New Customer
                </button>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">New Customer</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
                    <input
                      type="text"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phone</label>
                      <input
                        type="text"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="px-3 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700" onClick={handleCreateCustomer}>
                      Create
                    </button>
                    <button type="button" className="px-3 py-2 text-sm text-gray-500" onClick={() => { setCreateInline(false); setNewDisplayName(''); setNewPhone(''); setNewEmail(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!selectedCustomer}
              className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
              onClick={() => setStep(2)}
            >
              Next: Add Items
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Line Items */}
      {step === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Add Line Items</h2>

          <div className="space-y-2">
            <AzTabs
              selected={plantAzFilter}
              onSelect={(letter) => {
                setPlantAzFilter(letter === '#' ? null : letter);
                setPlantSearch('');
              }}
            />
            <input
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              placeholder="Search plants to add..."
              value={plantSearch}
              onChange={(e) => {
                setPlantAzFilter(null);
                setPlantSearch(e.target.value);
              }}
            />
            {plantResults.length > 0 && (
              <div className="border border-gray-200 rounded-md divide-y max-h-48 overflow-y-auto">
                {plantResults.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between" onClick={() => addPlantLine(p)}>
                    <span>{p.name} {p.variant && <span className="text-gray-400">({p.variant})</span>}</span>
                    <span className="text-gray-400">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {plantResults.length === 0 && (plantSearch.trim() || plantAzFilter) && (
              <p className="text-xs text-gray-500">No plant matches. Try SKU fragment, barcode digits, or first letter tabs.</p>
            )}
          </div>

          {lines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line, idx) => {
                    const exceeds = line.qtyOrdered > line.availableForWalkup;
                    return (
                      <tr key={line.plantCatalogId} className={exceeds && !line.overrideApproved ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2">
                          <p className="text-sm text-gray-900">{line.plantName}</p>
                          <p className="text-xs text-gray-400 font-mono">{line.plantSku}</p>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-sm font-medium ${line.availableForWalkup > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {line.availableForWalkup}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            className={`w-16 rounded border px-2 py-1 text-sm text-right ${
                              exceeds && !line.overrideApproved ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                            value={line.qtyOrdered}
                            onChange={(e) => updateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                          />
                        </td>
                        <td className="px-4 py-2">
                          {!exceeds && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
                          )}
                          {exceeds && line.overrideApproved && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Override</span>
                          )}
                          {exceeds && !line.overrideApproved && (
                            <button
                              type="button"
                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                              onClick={() => handleAdminOverride(idx)}
                            >
                              Exceeds limit -- Admin Override
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <button type="button" className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeLine(idx)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Search and add plants above</p>
          )}

          <div className="flex justify-between">
            <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              disabled={!allLinesValid}
              className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
              onClick={() => setStep(3)}
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review and Create */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800">
              This will be created as a Walk-Up order (not a preorder).
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Customer</h3>
              <p className="text-sm text-gray-900">{selectedCustomer?.displayName ?? newDisplayName}</p>
              {(selectedCustomer?.phone ?? newPhone) && (
                <p className="text-xs text-gray-500">{selectedCustomer?.phone ?? newPhone}</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Items ({lines.length})</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line) => (
                    <tr key={line.plantCatalogId}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {line.plantName}
                        {line.overrideApproved && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Admin Override
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{line.qtyOrdered}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{line.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              className="px-6 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
              onClick={handleSubmit}
            >
              {saving ? 'Creating...' : 'Create Walk-Up Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
