import { useEffect, useRef, type FC } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/mobile', label: 'Home', icon: '🏠', end: true },
  { to: '/mobile/pickup', label: 'Pickup', icon: '📦', end: false },
  { to: '/mobile/lookup', label: 'Lookup', icon: '🔍', end: false },
  { to: '/mobile/account', label: 'Account', icon: '👤', end: false },
];

export const MobileDrawer: FC<MobileDrawerProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSignOut = () => {
    logout();
    onClose();
    navigate('/login');
  };

  return (
    <>
      {/* Scrim */}
      {open && (
        <div
          aria-hidden="true"
          data-testid="mobile-drawer-scrim"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.45)',
          }}
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        data-testid="mobile-drawer"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 70,
          width: '80vw',
          maxWidth: 320,
          background: 'var(--joy-paper, #fff)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 220ms ease-out',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Header row with close button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-hawk-200, #e5e7eb)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display, serif)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--color-hawk-700)',
            }}
          >
            Navigation
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close navigation menu"
            data-testid="mobile-drawer-close"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-hawk-700)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav aria-label="Mobile navigation" style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 20px',
                fontSize: 16,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-hawk-700)' : 'inherit',
                background: isActive ? 'var(--color-hawk-50, #f5f3ff)' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '3px solid var(--color-hawk-700)' : '3px solid transparent',
                transition: 'background 150ms',
              })}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--color-hawk-200, #e5e7eb)' }}>
          <button
            type="button"
            onClick={handleSignOut}
            data-testid="mobile-drawer-signout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 20px',
              width: '100%',
              fontSize: 16,
              fontWeight: 400,
              color: 'var(--color-danger, #dc2626)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span aria-hidden="true">🚪</span>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
};
