import type { FC } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

interface MobileTabletRailProps {
  stationName?: string;
}

const navItems = [
  { to: '/mobile', label: 'Home', end: true },
  { to: '/mobile/pickup', label: 'Pickup', end: false },
  { to: '/mobile/lookup', label: 'Lookup', end: false },
  { to: '/mobile/account', label: 'Account', end: false },
];

export const MobileTabletRail: FC<MobileTabletRailProps> = ({ stationName = 'Hampton Hawks' }) => {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      aria-label="Tablet navigation rail"
      className="mobile-tablet-rail"
      style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-hawk-50, #f5f3ff)',
        borderRight: '1px solid var(--color-hawk-200, #e5e7eb)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      {/* Rail header */}
      <div
        style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid var(--color-hawk-200, #e5e7eb)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display, serif)',
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--color-hawk-700)',
            margin: 0,
          }}
        >
          {stationName}
        </p>
      </div>

      {/* Nav items */}
      <nav aria-label="Tablet navigation" style={{ flex: 1, padding: '8px 0' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--color-hawk-700)' : 'var(--color-hawk-800, #374151)',
              background: isActive ? 'color-mix(in srgb, var(--color-hawk-100, #ede9fe) 60%, transparent)' : 'transparent',
              textDecoration: 'none',
              borderLeft: isActive ? '3px solid var(--color-hawk-700)' : '3px solid transparent',
              borderRadius: '0 8px 8px 0',
              marginRight: 8,
              transition: 'background 150ms',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid var(--color-hawk-200, #e5e7eb)', padding: '8px 0' }}>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 20px',
            width: '100%',
            fontSize: 15,
            color: 'var(--color-danger, #dc2626)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Sign out
        </button>
      </div>

      <style>{`
        .mobile-tablet-rail {
          display: none;
        }
        @media (min-width: 768px) {
          .mobile-tablet-rail {
            display: flex;
          }
        }
      `}</style>
    </aside>
  );
};
