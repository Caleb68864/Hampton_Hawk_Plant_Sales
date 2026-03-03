import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { walkupApi } from '@/api/walkup.js';
import type { WalkUpAvailability } from '@/api/walkup.js';
import { customersApi } from '@/api/customers.js';
import { plantsApi } from '@/api/plants.js';
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
  overrideApproved: boolean;
  adminPin?: string;
  adminReason?: string;
}

interface WalkUpPrefillLine {
  plantCatalogId: string;
  plantName: string;
  plantSku: string;
  qtyOrdered?: number;
}

function isWalkUpPrefillLine(value: unknown): value is WalkUpPrefillLine {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.plantCatalogId === 'string'
    && typeof candidate.plantName === 'string'
    && typeof candidate.plantSku === 'string';
}

function readPreselectedItems(state: unknown, search: string): WalkUpPrefillLine[] {
  const stateItems =
    state && typeof state === 'object' && 'preselectedItems' in state
      ? (state as { preselectedItems?: unknown }).preselectedItems
      : undefined;
  if (Array.isArray(stateItems)) {
    return stateItems.filter(isWalkUpPrefillLine);
  }

  const params = new URLSearchParams(search);
  const raw = params.get('prefill');
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWalkUpPrefillLine) : [];
  } catch {
    return [];
  }
}

export function WalkUpNewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const openPinModal = useAuthStore((s) => s.openPinModal);
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createInline, setCreateInline] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Line items
  const [lines, setLines] = useState<WalkUpLineItem[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantResults, setPlantResults] = useState<Plant[]>([]);
  const [allAvailability, setAllAvailability] = useState<WalkUpAvailability[]>([]);
  const [loadingAllAvailability, setLoadingAllAvailability] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);

  const loadAllAvailability = useCallback(async () => {
    setLoadingAllAvailability(true);
    try {
      const availability = await walkupApi.getAllAvailability();
      setAllAvailability(availability);
      setAvailabilityLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load walk-up availability');
    } finally {
      setLoadingAllAvailability(false);
    }
  }, []);

  useEffect(() => {
    void loadAllAvailability();
  }, [loadAllAvailability]);

  const selectedQtyByPlantId = useMemo(() => {
    const qtyByPlantId = new Map<string, number>();
    for (const line of lines) {
      qtyByPlantId.set(line.plantCatalogId, (qtyByPlantId.get(line.plantCatalogId) ?? 0) + line.qtyOrdered);
    }
    return qtyByPlantId;
  }, [lines]);

  const availabilityByPlantId = useMemo(() => {
    const availabilityMap = new Map<string, WalkUpAvailability>();
    for (const availability of allAvailability) {
      availabilityMap.set(availability.plantCatalogId, availability);
    }
    return availabilityMap;
  }, [allAvailability]);

  function getLineAvailableForWalkup(line: WalkUpLineItem) {
    const snapshotAvailability = availabilityByPlantId.get(line.plantCatalogId)?.availableForWalkup ?? 0;
    const selectedQty = selectedQtyByPlantId.get(line.plantCatalogId) ?? 0;
    return Math.max(0, snapshotAvailability - selectedQty + line.qtyOrdered);
  }

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

    setLines([
      ...lines,
      {
        plantCatalogId: plant.id,
        plantName: plant.name,
        plantSku: plant.sku,
        qtyOrdered: 1,
        notes: '',
        overrideApproved: false,
      },
    ]);
    setPlantSearch('');
    setPlantResults([]);
  }

  function updateLineQty(idx: number, qty: number) {
    setLines(lines.map((l, i) => {
      if (i !== idx) return l;
      return { ...l, qtyOrdered: Math.max(1, qty) };
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
    return line.qtyOrdered <= getLineAvailableForWalkup(line) || line.overrideApproved;
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
              <input
                type="text"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
                placeholder="Search existing customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
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
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Current Walk-Up Availability Snapshot</h3>
              <button
                type="button"
                className="text-sm text-hawk-600 hover:text-hawk-700 disabled:opacity-50"
                onClick={() => void loadAllAvailability()}
                disabled={loadingAllAvailability}
              >
                {loadingAllAvailability ? 'Refreshing...' : 'Refresh Availability'}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Displayed availability is based on the latest server snapshot and adjusted locally for line quantities in this order.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">On Hand</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preorder Reserved/Remaining</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Available for Walk-Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allAvailability.length > 0 ? allAvailability.map((availability) => {
                    const selectedQty = selectedQtyByPlantId.get(availability.plantCatalogId) ?? 0;
                    const adjustedAvailableForWalkup = Math.max(0, availability.availableForWalkup - selectedQty);
                    const isOut = adjustedAvailableForWalkup === 0;
                    return (
                      <tr key={availability.plantCatalogId} className={isOut ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900">{availability.plantName}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 font-mono">{availability.plantSku}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{availability.onHandQty}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{availability.preorderRemaining}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold">
                          <span className={isOut ? 'text-red-600' : 'text-green-700'}>{adjustedAvailableForWalkup}</span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        {loadingAllAvailability
                          ? 'Loading availability...'
                          : availabilityLoaded
                            ? 'No active plant availability found.'
                            : 'Availability not loaded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
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
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between" onClick={() => addPlantLine(p)}>
                    <span>{p.name} {p.variant && <span className="text-gray-400">({p.variant})</span>}</span>
                    <span className="text-gray-400">{p.sku}</span>
                  </button>
                ))}
              </div>
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
                    const lineAvailableForWalkup = getLineAvailableForWalkup(line);
                    const exceeds = line.qtyOrdered > lineAvailableForWalkup;
                    return (
                      <tr key={line.plantCatalogId} className={exceeds && !line.overrideApproved ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2">
                          <p className="text-sm text-gray-900">{line.plantName}</p>
                          <p className="text-xs text-gray-400 font-mono">{line.plantSku}</p>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-sm font-medium ${lineAvailableForWalkup > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {lineAvailableForWalkup}
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
