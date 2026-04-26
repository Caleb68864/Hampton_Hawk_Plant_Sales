import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { customersApi } from '@/api/customers.js';
import { ordersApi } from '@/api/orders.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { ConfirmModal } from '@/components/shared/ConfirmModal.js';
import { StatusChip } from '@/components/shared/StatusChip.js';
import { JoyPageShell } from '@/components/shared/JoyPageShell.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import type { Customer, CreateCustomerRequest } from '@/types/customer.js';
import type { Order } from '@/types/order.js';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const [form, setForm] = useState({
    displayName: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    Promise.all([
      customersApi.getById(id!),
      ordersApi.list({ customerId: id, pageSize: 50 }),
    ])
      .then(([c, orderResult]) => {
        setCustomer(c);
        setOrders(orderResult.items);
        setForm({
          displayName: c.displayName,
          firstName: c.firstName ?? '',
          lastName: c.lastName ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          notes: c.notes ?? '',
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load customer'))
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
      const data: CreateCustomerRequest = {
        displayName: form.displayName.trim(),
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (isNew) {
        const created = await customersApi.create(data);
        navigate(`/customers/${created.id}`, { replace: true });
      } else {
        const updated = await customersApi.update(id!, data);
        setCustomer(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setShowDelete(false);
    setSaving(true);
    try {
      await customersApi.delete(id!);
      navigate('/customers', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete customer');
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <JoyPageShell
      title={isNew ? 'New Customer' : `Edit: ${customer?.displayName ?? ''}`}
      eyebrow={isNew ? 'Create' : 'Customer'}
      actions={
        <TouchButton variant="ghost" onClick={() => navigate('/customers')}>
          Back to Customers
        </TouchButton>
      }
    >
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {customer?.pickupCode && (
        <div className="bg-hawk-50 border border-hawk-200 rounded-md p-3 text-sm">
          <span className="font-medium text-hawk-700">Pickup Code:</span>{' '}
          <span className="font-mono text-hawk-900 text-lg">{customer.pickupCode}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="cust-display" className="block text-sm font-medium text-gray-700">Display Name *</label>
            <input id="cust-display" type="text" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cust-first" className="block text-sm font-medium text-gray-700">First Name</label>
            <input id="cust-first" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cust-last" className="block text-sm font-medium text-gray-700">Last Name</label>
            <input id="cust-last" type="text" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cust-phone" className="block text-sm font-medium text-gray-700">Phone</label>
            <input id="cust-phone" type="tel" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>
          <div>
            <label htmlFor="cust-email" className="block text-sm font-medium text-gray-700">Email</label>
            <input id="cust-email" type="email" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cust-notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea id="cust-notes" rows={2} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {!isNew && (
              <button type="button" className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700" onClick={() => setShowDelete(true)}>
                Delete Customer
              </button>
            )}
          </div>
          <TouchButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Create Customer' : 'Save Changes'}
          </TouchButton>
        </div>
      </form>

      {!isNew && orders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Orders ({orders.length})</h2>
          <div className="divide-y divide-gray-200">
            {orders.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between py-2 hover:bg-gray-50 px-2 rounded">
                <span className="text-sm text-gray-900">{o.orderNumber}</span>
                <StatusChip status={o.status} hasIssue={o.hasIssue} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${customer?.displayName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </JoyPageShell>
  );
}
