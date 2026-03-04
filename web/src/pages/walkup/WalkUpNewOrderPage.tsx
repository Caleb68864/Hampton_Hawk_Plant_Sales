import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
    typeof state === 'object'
      ? (state as { preselectedItems?: unknown }).preselectedItems
      : undefined;
  if (Array.isArray(stateItems)) return stateItems.filter(isWalkUpPrefillLine);

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

function normalizeSearchText(value: string) {
  return value.toLowerCase().trim();
}

function rankResults<T>(items: T[], score: (item: T) => number) {
  return [...items]
    .map((item) => ({ item, score: score(item) }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

function scoreCustomerMatch(customer: Customer, normalized: string) {
  const display = normalizeSearchText(customer.displayName);
  const phone = normalizeSearchText(customer.phone ?? '');
  const email = normalizeSearchText(customer.email ?? '');
  if (display === normalized) return 300;
  if (display.startsWith(normalized)) return 200;
  if (phone.includes(normalized)) return 150;
  if (email.includes(normalized)) return 120;
  if (display.includes(normalized)) return 100;
  return 0;
}

function scorePlantMatch(plant: Plant, normalized: string) {
  const name = normalizeSearchText(plant.name);
  const sku = normalizeSearchText(plant.sku);
  const barcode = normalizeSearchText(plant.barcode);
  const variant = normalizeSearchText(plant.variant ?? '');
  if (sku === normalized || barcode === normalized) return 300;
  if (sku.startsWith(normalized) || barcode.startsWith(normalized)) return 220;
  if (name.startsWith(normalized)) return 180;
  if (variant.startsWith(normalized)) return 140;
  if (name.includes(normalized) || variant.includes(normalized) || sku.includes(normalized)) return 100;
  return 0;
}

export function WalkUpNewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const openPinModal = useAuthStore((s) => s.openPinModal);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerAzFilter, setCustomerAzFilter] = useState<string | null>(null);
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createInline, setCreateInline] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const [lines, setLines] = useState<WalkUpLineItem[]>([]);
  const [plantSearch, setPlantSearch] = useState('');
  const [plantAzFilter, setPlantAzFilter] = useState<string | null>(null);
  const [plantResults, setPlantResults] = useState<Plant[]>([]);
  const [allAvailability, setAllAvailability] = useState<WalkUpAvailability[]>([]);
  const [showUnavailableItems, setShowUnavailableItems] = useState(false);
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

  useEffect(() => {
    const preselected = readPreselectedItems(location.state, location.search);
    if (!preselected.length) return;
    setLines((existing) => {
      if (existing.length > 0) return existing;
      return preselected.map((line) => ({
        plantCatalogId: line.plantCatalogId,
        plantName: line.plantName,
        plantSku: line.plantSku,
        qtyOrdered: Math.max(1, line.qtyOrdered ?? 1),
        notes: '',
        overrideApproved: false,
      }));
    });
  }, [location.search, location.state]);

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

  function getAdjustedAvailableForWalkup(plantCatalogId: string) {
    const snapshotAvailability = availabilityByPlantId.get(plantCatalogId)?.availableForWalkup ?? 0;
    const selectedQty = selectedQtyByPlantId.get(plantCatalogId) ?? 0;
    return Math.max(0, snapshotAvailability - selectedQty);
  }

  const displayedAvailability = useMemo(() => {
    if (showUnavailableItems) return allAvailability;
    return allAvailability.filter((availability) => {
      const snapshotAvailability = availabilityByPlantId.get(availability.plantCatalogId)?.availableForWalkup ?? 0;
      const selectedQty = selectedQtyByPlantId.get(availability.plantCatalogId) ?? 0;
      return Math.max(0, snapshotAvailability - selectedQty) > 0;
    });
  }, [allAvailability, availabilityByPlantId, showUnavailableItems, selectedQtyByPlantId]);

  const displayedPlantResults = useMemo(() => {
    if (showUnavailableItems || !availabilityLoaded) return plantResults;
    return plantResults.filter((plant) => {
      const snapshotAvailability = availabilityByPlantId.get(plant.id)?.availableForWalkup ?? 0;
      const selectedQty = selectedQtyByPlantId.get(plant.id) ?? 0;
      return Math.max(0, snapshotAvailability - selectedQty) > 0;
    });
  }, [availabilityByPlantId, availabilityLoaded, plantResults, showUnavailableItems, selectedQtyByPlantId]);

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerResults([]);
      return;
    }
    const trimmedSearch = customerSearch.trim();
    const query = trimmedSearch || (customerAzFilter ? `${customerAzFilter}*` : '');
    if (!query) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await customersApi.list({ search: query, pageSize: 20 });
        if (trimmedSearch) {
          const normalized = normalizeSearchText(trimmedSearch);
          setCustomerResults(rankResults(r.items, (customer) => scoreCustomerMatch(customer, normalized)));
          return;
        }
        setCustomerResults(r.items);
      } catch {
        setCustomerResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, customerAzFilter, selectedCustomer]);

  useEffect(() => {
    const trimmedSearch = plantSearch.trim();
    const query = trimmedSearch || (plantAzFilter ? `${plantAzFilter}*` : '');
    if (!query) {
      setPlantResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await plantsApi.list({ search: query, pageSize: 40, activeOnly: true });
        if (trimmedSearch) {
          const normalized = normalizeSearchText(trimmedSearch);
          setPlantResults(rankResults(r.items, (plant) => scorePlantMatch(plant, normalized)));
          return;
        }
        setPlantResults(r.items);
      } catch {
        setPlantResults([]);
      }
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

  async function addPlantLine(plant: { id: string; name: string; sku: string }) {
    const existing = lines.find((l) => l.plantCatalogId === plant.id);
    if (existing) {
      setPlantSearch('');
      setPlantResults([]);
      return;
    }

    setLines([
      ...lines,
      { plantCatalogId: plant.id, plantName: plant.name, plantSku: plant.sku, qtyOrdered: 1, notes: '', overrideApproved: false },
    ]);
    setPlantSearch('');
    setPlantResults([]);
  }

  function updateLineQty(idx: number, qty: number) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, qtyOrdered: Math.max(1, qty) } : l)));
  }

  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }

  async function handleAdminOverride(idx: number) {
    const result = await openPinModal();
    if (!result) return;
    setLines(lines.map((l, i) => (i === idx ? { ...l, overrideApproved: true, adminPin: result.pin, adminReason: result.reason } : l)));
  }

  const allLinesValid = lines.length > 0 && lines.every((line) => line.qtyOrdered <= getLineAvailableForWalkup(line) || line.overrideApproved);
  const hasCustomer = Boolean(selectedCustomer || newDisplayName.trim());
  const hasLines = lines.length > 0;
  const canSubmit = hasCustomer && allLinesValid;

  async function handleSubmit() {
    if (!hasCustomer) return setError('Please select or create a customer');
    if (!hasLines) return setError('Please add at least one line item');
    if (!allLinesValid) return setError('One or more lines exceed walk-up availability and require an admin override');

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
        await walkupApi.addLine(order.id, {
          plantCatalogId: line.plantCatalogId,
          qtyOrdered: line.qtyOrdered,
          notes: line.notes || null,
        }, line.adminPin, line.adminReason);
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
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Walk-Up</span>
        </h1>
        <button type="button" className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate('/station')}>Back to Station Home</button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Select or Create Customer</h2>

        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-hawk-50 border border-hawk-200 rounded-md p-3">
            <div>
              <p className="text-sm font-medium text-hawk-900">{selectedCustomer.displayName}</p>
              {selectedCustomer.phone && <p className="text-xs text-hawk-700">{selectedCustomer.phone}</p>}
            </div>
            <button type="button" className="text-sm text-hawk-600 hover:text-hawk-700" onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}>Change</button>
          </div>
        ) : (
          <div className="space-y-3">
            <AzTabs selected={customerAzFilter} onSelect={setCustomerAzFilter} />
            <input
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              placeholder="Search existing customers..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerAzFilter(null);
                setCustomerSearch(e.target.value);
              }}
              autoFocus
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
              <button type="button" className="text-sm text-blue-600 hover:text-blue-700" onClick={() => setCreateInline(true)}>+ Create New Customer</button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">New Customer</h3>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Display Name *</label>
                  <input type="text" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Phone</label>
                    <input type="text" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input type="email" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="px-3 py-2 text-sm text-gray-600" onClick={() => { setCreateInline(false); setNewDisplayName(''); setNewPhone(''); setNewEmail(''); }}>Cancel</button>
                  <button type="button" className="px-4 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50" disabled={!newDisplayName.trim()} onClick={() => void handleCreateCustomer()}>Create Customer</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Add Line Items</h2>

        {lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2" />
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
                      <td className="px-4 py-2 text-right"><span className={`text-sm font-medium ${lineAvailableForWalkup > 0 ? 'text-green-600' : 'text-red-600'}`}>{lineAvailableForWalkup}</span></td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          className={`w-16 rounded border px-2 py-1 text-sm text-right ${exceeds && !line.overrideApproved ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                          value={line.qtyOrdered}
                          onChange={(e) => updateLineQty(idx, parseInt(e.target.value, 10) || 1)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        {!exceeds && <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>}
                        {exceeds && line.overrideApproved && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Override</span>}
                        {exceeds && !line.overrideApproved && (
                          <button type="button" className="text-xs text-red-600 hover:text-red-700 font-medium" onClick={() => void handleAdminOverride(idx)}>
                            Exceeds limit -- Admin Override
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <button type="button" className="text-red-500 hover:text-red-700 text-sm" onClick={() => removeLine(idx)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">Use the plant list below to add items</p>
        )}

        {!hasLines && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">Add at least one line item before creating the order.</p>}
        {hasLines && !allLinesValid && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">One or more lines exceed walk-up availability and need admin override.</p>}
      </div>

      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">This will be created as a Walk-Up order (not a preorder).</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Order Summary</h2>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Customer</h3>
            <p className="text-sm text-gray-900">{selectedCustomer?.displayName ?? newDisplayName}</p>
            {(selectedCustomer?.phone ?? newPhone) && <p className="text-xs text-gray-500">{selectedCustomer?.phone ?? newPhone}</p>}
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
                      {line.overrideApproved && <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Admin Override</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">{line.qtyOrdered}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{line.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" disabled={saving || !canSubmit} className="px-6 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50" onClick={() => void handleSubmit()}>
            {saving ? 'Creating...' : 'Create Walk-Up Order'}
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Plant List to Add Line Items</h2>
          <div className="space-y-2">
            <AzTabs selected={plantAzFilter} onSelect={setPlantAzFilter} />
            <input
              type="text"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              placeholder="Search plants to add..."
              value={plantSearch}
              onChange={(e) => { setPlantAzFilter(null); setPlantSearch(e.target.value); }}
            />
            {displayedPlantResults.length > 0 && (
              <div className="border border-gray-200 rounded-md divide-y max-h-48 overflow-y-auto">
                {displayedPlantResults.map((p) => (
                  <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between" onClick={() => void addPlantLine(p)}>
                    <span>{p.name} {p.variant && <span className="text-gray-400">({p.variant})</span>}</span>
                    <span className="text-gray-400">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {displayedPlantResults.length === 0 && (plantSearch.trim() || plantAzFilter) && (
              <p className="text-xs text-gray-500">
                {plantResults.length > 0 && !showUnavailableItems
                  ? 'Matching plants are unavailable right now. Enable "Show unavailable items" to include zero-availability plants.'
                  : 'No plant matches. Try SKU fragment, barcode digits, or first letter tabs.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Current Walk-Up Availability Snapshot</h3>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-hawk-600 focus:ring-hawk-500"
                    checked={showUnavailableItems}
                    onChange={(e) => setShowUnavailableItems(e.target.checked)}
                  />
                  Show unavailable items
                </label>
                <button type="button" className="text-sm text-hawk-600 hover:text-hawk-700 disabled:opacity-50" onClick={() => void loadAllAvailability()} disabled={loadingAllAvailability}>
                  {loadingAllAvailability ? 'Refreshing...' : 'Refresh Availability'}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">Displayed availability is based on the latest server snapshot and adjusted locally for line quantities in this order.</p>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">On Hand</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preorder Reserved/Remaining</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Available for Walk-Up</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedAvailability.length > 0 ? displayedAvailability.map((availability) => {
                    const adjustedAvailableForWalkup = getAdjustedAvailableForWalkup(availability.plantCatalogId);
                    const isOut = adjustedAvailableForWalkup === 0;
                    const alreadyAdded = lines.some((line) => line.plantCatalogId === availability.plantCatalogId);
                    return (
                      <tr key={availability.plantCatalogId} className={isOut ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900">{availability.plantName}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 font-mono">{availability.plantSku}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{availability.onHandQty}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{availability.preorderRemaining}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold"><span className={isOut ? 'text-red-600' : 'text-green-700'}>{adjustedAvailableForWalkup}</span></td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-hawk-200 bg-hawk-50 px-3 py-1 text-sm font-medium text-hawk-700 transition hover:bg-hawk-100 hover:text-hawk-800 cursor-pointer disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={alreadyAdded}
                            onClick={() => void addPlantLine({ id: availability.plantCatalogId, name: availability.plantName, sku: availability.plantSku })}
                          >
                            {alreadyAdded ? 'Added' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                        {loadingAllAvailability
                          ? 'Loading availability...'
                          : availabilityLoaded
                            ? showUnavailableItems
                              ? 'No active plant availability found.'
                              : 'No available plants right now. Enable "Show unavailable items" to view zero-availability plants.'
                            : 'Availability not loaded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
