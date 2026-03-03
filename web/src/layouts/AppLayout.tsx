import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore.js';
import { QuickFindOverlay } from '@/components/shared/QuickFindOverlay.js';
import { GlobalQuickFind } from '@/components/shared/GlobalQuickFind.js';
import { AdminPinModal } from '@/components/shared/AdminPinModal.js';

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/plants', label: 'Plants' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/customers', label: 'Customers' },
  { to: '/sellers', label: 'Sellers' },
  { to: '/orders', label: 'Orders' },
  { to: '/station', label: 'Station Home' },
  { to: '/imports', label: 'Imports' },
  { to: '/reports', label: 'Reports' },
  { to: '/reports/leftover-inventory', label: 'Leftover Inventory' },
  { to: '/settings', label: 'Settings' },
  { to: '/docs', label: 'Docs' },
];

export function AppLayout() {
  const { saleClosed, fetchSettings } = useAppStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-hawk-700 text-white shadow-md">
        <div className="px-4 py-3 flex items-center justify-center gap-3">
          <img src="/hawk-logo.png" alt="Hampton Hawks" className="h-10 w-10 rounded-full bg-white p-0.5" />
          <h1 className="text-2xl font-bold">Hampton Hawks Plant Sales</h1>
        </div>
        <nav className="flex flex-wrap gap-1 px-4 pb-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-hawk-700'
                    : 'text-hawk-100 hover:bg-hawk-600'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <GlobalQuickFind />
      </header>

      {saleClosed && (
        <div className="bg-red-600 text-white text-center py-2 font-semibold text-sm">
          SALE CLOSED: scanning disabled
        </div>
      )}

      <main className="flex-1 p-6">
        <Outlet />
      </main>

      <QuickFindOverlay />
      <AdminPinModal />
    </div>
  );
}
