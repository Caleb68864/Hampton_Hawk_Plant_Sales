import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore.js';
import { QuickFindOverlay } from '@/components/shared/QuickFindOverlay.js';
import { GlobalQuickFind } from '@/components/shared/GlobalQuickFind.js';

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
      <header className="relative overflow-hidden border-b-4 border-gold-300 bg-gradient-to-r from-hawk-700 via-hawk-800 to-hawk-900 text-white shadow-md">
        {/* Gilded radial glow accent (mirrors .brand-header::after from joy demo) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-60 w-60"
          style={{
            background:
              'radial-gradient(circle, rgba(237,201,109,0.18) 0%, transparent 60%)',
          }}
        />

        <div className="relative flex items-center justify-center gap-3 px-4 py-4">
          {/* Crest dot — gilded gradient circle hosting the logo */}
          <div
            className="crest relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, var(--color-gold-200), var(--color-gold-500) 70%, var(--color-gold-800))',
              boxShadow:
                '0 0 0 2px rgba(255,255,255,0.18), 0 6px 14px -6px rgba(0,0,0,0.5)',
            }}
          >
            <img
              src="/hawk-logo.png"
              alt="Hampton Hawks"
              className="h-8 w-8 rounded-full"
            />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold-200">
              Hampton Hawks
            </p>
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight">
              Plant Sales
            </h1>
          </div>
        </div>

        <nav className="relative flex flex-wrap gap-1 border-t border-white/10 px-4 pb-3 pt-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1 rounded-md text-sm font-semibold transition-colors ${
                  isActive
                    ? 'joy-shadow-press bg-[color:var(--joy-paper)] text-hawk-700'
                    : 'text-hawk-100 hover:bg-gold-200/10 hover:text-white'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      boxShadow:
                        '0 1px 0 rgba(0,0,0,0.06), inset 0 -2px 0 rgba(0,0,0,0.06)',
                    }
                  : undefined
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <GlobalQuickFind />
      </header>

      {saleClosed && (
        <div className="px-4 pt-3">
          <div
            className="joy-shadow-plum mx-auto max-w-6xl rounded-lg border border-red-200 bg-[color:var(--joy-paper)] px-4 py-2 text-center text-sm font-semibold text-red-700"
          >
            SALE CLOSED: scanning disabled
          </div>
        </div>
      )}

      <main className="paper-grain relative flex-1 p-6">
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>

      <QuickFindOverlay />
    </div>
  );
}
