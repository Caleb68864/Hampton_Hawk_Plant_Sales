import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { sellersApi } from '@/api/sellers.js';
import { ordersApi } from '@/api/orders.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { ConfirmModal } from '@/components/shared/ConfirmModal.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { Seller, CreateSellerRequest } from '@/types/seller.js';
import type { Order } from '@/types/order.js';

export function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [seller, setSeller] = useState<Seller | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    grade: '',
    teacher: '',
    notes: '',
  });

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    Promise.all([
      sellersApi.getById(id!),
      ordersApi.list({ sellerId: id, pageSize: 50 }),
    ])
      .then(([s, orderResult]) => {
        setSeller(s);
        setOrders(orderResult.items);
        setForm({
          displayName: s.displayName,
          firstName: s.firstName ?? '',
          lastName: s.lastName ?? '',
          grade: s.grade ?? '',
          teacher: s.teacher ?? '',
          notes: s.notes ?? '',
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load seller'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data: CreateSellerRequest = {
        displayName: form.displayName.trim(),
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        grade: form.grade.trim() || null,
        teacher: form.teacher.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (isNew) {
        const created = await sellersApi.create(data);
        navigate(`/sellers/${created.id}`, { replace: true });
      } else {
        const updated = await sellersApi.update(id!, data);
        setSeller(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save seller');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDelete(false);
    setSaving(true);
    try {
      await sellersApi.delete(id!);
      navigate('/sellers', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete seller');
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <JoyPageShell
      title={isNew ? 'New Seller' : `Edit: ${seller?.displayName ?? ''}`}
      eyebrow={isNew ? 'Create' : 'Seller'}
      actions={
        <TouchButton variant="ghost" onClick={() => navigate('/sellers')}>
          Back to Sellers
        </TouchButton>
      }
    >
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="seller-display" className="block text-sm font-medium text-gray-700">Display Name *</label>
            <input id="seller-display" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="seller-first" className="block text-sm font-medium text-gray-700">First Name</label>
            <input id="seller-first" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="seller-last" className="block text-sm font-medium text-gray-700">Last Name</label>
            <input id="seller-last" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="seller-grade" className="block text-sm font-medium text-gray-700">Grade</label>
            <input id="seller-grade" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.grade} onChange={(e) => updateField('grade', e.target.value)} />
          </div>
          <div>
            <label htmlFor="seller-teacher" className="block text-sm font-medium text-gray-700">Teacher</label>
            <input id="seller-teacher" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.teacher} onChange={(e) => updateField('teacher', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="seller-notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea id="seller-notes" rows={2} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {!isNew && (
              <button type="button" className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700" onClick={() => setShowDelete(true)}>
                Delete Seller
              </button>
            )}
          </div>
          <TouchButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Seller' : 'Save Changes'}
          </TouchButton>
        </div>
      </form>

      {!isNew && orders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Orders ({orders.length})</h2>
          <div className="divide-y divide-gray-200">
            {orders.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between py-2 hover:bg-gray-50 px-2 rounded">
                <div>
                  <span className="text-sm text-gray-900">{o.orderNumber}</span>
                  <span className="ml-2 text-sm text-gray-500">{o.customerDisplayName}</span>
                </div>
                <StatusChip status={o.status} hasIssue={o.hasIssue} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Seller"
        message={`Are you sure you want to delete "${seller?.displayName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </JoyPageShell>
  );
}
