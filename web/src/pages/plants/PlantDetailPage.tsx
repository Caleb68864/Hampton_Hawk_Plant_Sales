import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plantsApi } from '@/api/plants.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { ConfirmModal } from '@/components/shared/ConfirmModal.js';
import type { Plant, CreatePlantRequest, UpdatePlantRequest } from '@/types/plant.js';

export function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [plant, setPlant] = useState<Plant | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    variant: '',
    price: '',
    isActive: true,
  });

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    plantsApi
      .getById(id!)
      .then((p) => {
        setPlant(p);
        setForm({
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          variant: p.variant ?? '',
          price: p.price != null ? String(p.price) : '',
          isActive: p.isActive,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load plant'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const price = form.price.trim() ? Number(form.price) : null;

      if (isNew) {
        const data: CreatePlantRequest = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
          variant: form.variant.trim() || null,
          price,
          isActive: form.isActive,
        };
        const created = await plantsApi.create(data);
        navigate(`/plants/${created.id}`, { replace: true });
      } else {
        const data: UpdatePlantRequest = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
          variant: form.variant.trim() || null,
          price,
          isActive: form.isActive,
        };
        const updated = await plantsApi.update(id!, data);
        setPlant(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plant');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDelete(false);
    setSaving(true);
    try {
      await plantsApi.delete(id!);
      navigate('/plants', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete plant');
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{isNew ? 'New Plant' : `Edit: ${plant?.name ?? ''}`}</h1>
        <div className="flex items-center gap-3">
          {!isNew && plant && (
            <a
              href={`/print/labels?plantId=${plant.id}&density=test`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-hawk-700 hover:text-hawk-800 font-medium"
            >
              Print Label
            </a>
          )}
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => navigate('/plants')}
          >
            Back to Plants
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {plant?.barcodeLockedAt && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
          Barcode locked at {new Date(plant.barcodeLockedAt).toLocaleString()}. Changing the barcode may affect existing orders.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="plant-name" className="block text-sm font-medium text-gray-700">Name *</label>
            <input
              id="plant-name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="plant-variant" className="block text-sm font-medium text-gray-700">Variant</label>
            <input
              id="plant-variant"
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={form.variant}
              onChange={(e) => updateField('variant', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="plant-sku" className="block text-sm font-medium text-gray-700">SKU *</label>
            <input
              id="plant-sku"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={form.sku}
              onChange={(e) => updateField('sku', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="plant-barcode" className="block text-sm font-medium text-gray-700">Barcode *</label>
            <input
              id="plant-barcode"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={form.barcode}
              onChange={(e) => updateField('barcode', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="plant-price" className="block text-sm font-medium text-gray-700">Price</label>
            <input
              id="plant-price"
              type="number"
              step="0.01"
              min="0"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
            />
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-hawk-600 focus:ring-hawk-500"
                checked={form.isActive}
                onChange={(e) => updateField('isActive', e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {!isNew && (
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                onClick={() => setShowDelete(true)}
              >
                Delete Plant
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-hawk-600 rounded-md hover:bg-hawk-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isNew ? 'Create Plant' : 'Save Changes'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Plant"
        message={`Are you sure you want to delete "${plant?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
