import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore.js';

export function MobileAccountPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!currentUser) {
    return (
      <div className="mobile-page-bg p-4">
        <p className="text-sm text-hawk-700">Not signed in.</p>
      </div>
    );
  }

  return (
    <div className="mobile-page-bg space-y-4 p-4 pb-24">
      <header className="space-y-1">
        <p className="mobile-type-eyebrow text-gold-700">Account</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-hawk-800">
          {currentUser.username}
        </h1>
      </header>

      <section className="joy-shadow-plum rounded-2xl border border-gold-200 bg-[color:var(--joy-paper)] p-4">
        <dl className="space-y-3">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.22em] text-hawk-600">
              Username
            </dt>
            <dd className="mt-1 font-mono text-sm text-hawk-900">
              {currentUser.username}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold uppercase tracking-[0.22em] text-hawk-600">
              Roles
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {currentUser.roles.length === 0 ? (
                <span className="text-sm italic text-hawk-600">No roles assigned</span>
              ) : (
                currentUser.roles.map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-gold-300 bg-gold-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-hawk-800"
                  >
                    {role}
                  </span>
                ))
              )}
            </dd>
          </div>

        </dl>
      </section>

      <section className="space-y-2 rounded-2xl border border-hawk-200 bg-white/70 p-4">
        <h2 className="font-display text-lg font-semibold text-hawk-800">
          What you can do
        </h2>
        <p className="text-sm text-hawk-700">
          Available mobile workflows depend on your role. Use the drawer to
          navigate. To manage volunteers, account passwords, or roles, sign in
          on a desktop and visit Settings → User Management.
        </p>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        style={{ minHeight: 'var(--mobile-touch-min, 56px)' }}
        className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-base font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      >
        Sign out
      </button>
    </div>
  );
}

export default MobileAccountPage;
