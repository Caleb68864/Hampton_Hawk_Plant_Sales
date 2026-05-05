import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '@/api/users.js';
import { SectionHeading } from '@/components/shared/SectionHeading.js';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner.js';
import { ErrorBanner } from '@/components/shared/ErrorBanner.js';
import { TouchButton } from '@/components/shared/TouchButton.js';
import { useAuthStore } from '@/stores/authStore.js';
import type { AppUser } from '@/types/user.js';
import type { AppRole } from '@/types/auth.js';
import {
  ALL_ROLES,
  validateUserForm,
  hasFormErrors,
  stationUserPresets,
  type UserFormValues,
  type UserFormErrors,
} from './userManagementHelpers.js';

// ── Blank form ────────────────────────────────────────────────────────────────

function blankForm(): UserFormValues {
  return { username: '', displayName: '', password: '', isActive: true, roles: ['Volunteer'] };
}

// ── Role badges ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
        role === 'Admin'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-sky-100 text-sky-800'
      }`}
    >
      {role}
    </span>
  );
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

interface UserFormModalProps {
  user: AppUser | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormModal({ user, onClose, onSaved }: UserFormModalProps) {
  const isEdit = user !== null;
  const [form, setForm] = useState<UserFormValues>(
    user
      ? { username: user.username, displayName: user.displayName, password: '', isActive: user.isActive, roles: user.roles }
      : blankForm(),
  );
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function setField<K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleRole(role: AppRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
    setErrors((e) => ({ ...e, roles: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateUserForm(form, !isEdit);
    if (hasFormErrors(errs)) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setServerError(null);
    try {
      if (isEdit) {
        await usersApi.update(user.id, {
          displayName: form.displayName.trim(),
          isActive: form.isActive,
          roles: form.roles,
        });
      } else {
        await usersApi.create({
          username: form.username.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          isActive: form.isActive,
          roles: form.roles,
        });
      }
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  }

  const presets = stationUserPresets();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `Edit ${user.username}` : 'Create User'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {serverError && <ErrorBanner message={serverError} onDismiss={() => setServerError(null)} />}

          {!isEdit && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Quick-fill a station preset:</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.username}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        username: p.username,
                        displayName: p.displayName,
                        roles: ['Volunteer'],
                      }))
                    }
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-hawk-400 hover:bg-hawk-50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-1 text-sm text-gray-700">
            <span className="font-medium">Username</span>
            <input
              type="text"
              autoComplete="off"
              disabled={isEdit}
              value={form.username}
              onChange={(e) => setField('username', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="POS2"
            />
            {errors.username && <span className="text-xs text-red-600">{errors.username}</span>}
          </label>

          <label className="block space-y-1 text-sm text-gray-700">
            <span className="font-medium">Display name</span>
            <input
              type="text"
              autoComplete="off"
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="POS Station 2"
            />
            {errors.displayName && <span className="text-xs text-red-600">{errors.displayName}</span>}
          </label>

          {!isEdit && (
            <label className="block space-y-1 text-sm text-gray-700">
              <span className="font-medium">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
              {errors.password && <span className="text-xs text-red-600">{errors.password}</span>}
            </label>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">Roles</legend>
            <div className="flex gap-3">
              {ALL_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
            {errors.roles && <span className="text-xs text-red-600">{errors.roles}</span>}
          </fieldset>

          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            <span className="font-medium">Active</span>
            <span className="text-xs text-gray-500">(inactive users cannot log in)</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <TouchButton variant="primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
            </TouchButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reset password modal ──────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  user: AppUser;
  onClose: () => void;
  onDone: () => void;
}

function ResetPasswordModal({ user, onClose, onDone }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await usersApi.resetPassword(user.id, { newPassword: password });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Reset password — {user.username}</h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          <label className="block space-y-1 text-sm text-gray-700">
            <span className="font-medium">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <TouchButton variant="primary" disabled={saving}>
              {saving ? 'Resetting…' : 'Reset password'}
            </TouchButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: AppUser;
  currentUserId: number | undefined;
  onEdit: (user: AppUser) => void;
  onResetPassword: (user: AppUser) => void;
  onToggleActive: (user: AppUser) => void;
}

function UserRow({ user, currentUserId, onEdit, onResetPassword, onToggleActive }: UserRowProps) {
  const isSelf = user.id === currentUserId;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm">
        <div className="font-mono font-medium text-gray-900">{user.username}</div>
        <div className="text-xs text-gray-500">{user.displayName}</div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {user.isActive ? (
          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Active
          </span>
        ) : (
          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            Disabled
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onResetPassword(user)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset PW
          </button>
          <button
            type="button"
            disabled={isSelf}
            onClick={() => onToggleActive(user)}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              isSelf
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : user.isActive
                ? 'border-red-300 bg-white text-red-700 hover:bg-red-50'
                : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50'
            }`}
            title={isSelf ? 'Cannot disable your own account' : undefined}
          >
            {user.isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UserManagementPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null | 'new'>(null);
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleToggleActive(user: AppUser) {
    try {
      await usersApi.update(user.id, {
        displayName: user.displayName,
        isActive: !user.isActive,
        roles: user.roles,
      });
      setActionMessage(`${user.username} ${user.isActive ? 'disabled' : 'enabled'}.`);
      void loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  }

  function handleSaved() {
    setEditingUser(null);
    setActionMessage('User saved.');
    void loadUsers();
  }

  function handlePasswordReset() {
    setResetUser(null);
    setActionMessage('Password reset.');
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="paper-grain max-w-4xl mx-auto space-y-4 relative">
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <SectionHeading level={1} eyebrow="Admin">User Management</SectionHeading>
            <p className="text-sm text-hawk-600" style={{ fontFamily: "var(--font-body), 'Manrope', sans-serif" }}>
              Create and manage station, mobile, and admin accounts.{' '}
              <Link to="/settings" className="underline text-hawk-700 hover:text-hawk-900">
                ← Back to Settings
              </Link>
            </p>
          </div>
          <TouchButton variant="primary" onClick={() => setEditingUser('new')}>
            + Add user
          </TouchButton>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {actionMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex justify-between items-center">
            {actionMessage}
            <button type="button" onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-800 text-xs ml-4">
              ✕
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-hawk-200 joy-shadow-plum overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No users found.{' '}
              <button type="button" onClick={() => setEditingUser('new')} className="underline text-hawk-700">
                Create the first user.
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">User</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Roles</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={currentUser?.id}
                    onEdit={setEditingUser}
                    onResetPassword={setResetUser}
                    onToggleActive={handleToggleActive}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-700 mb-1">Sale-day setup tips</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Use quick-fill presets (POS2, Pickup1, Mobile1…) when creating new station accounts.</li>
            <li>Assign the <strong>Volunteer</strong> role for scan/pickup stations; <strong>Admin</strong> for full access.</li>
            <li>Disable accounts rather than deleting them to preserve audit history.</li>
            <li>Mobile users can be created here on the fly and given a simple PIN-style password.</li>
          </ul>
        </div>
      </div>

      {editingUser !== null && (
        <UserFormModal
          user={editingUser === 'new' ? null : editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {resetUser !== null && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={handlePasswordReset}
        />
      )}
    </div>
  );
}
