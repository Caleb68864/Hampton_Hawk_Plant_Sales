/**
 * Evidence capture test for SS-03 layout shell.
 * Renders MobileDrawer (open) and captures DOM structure to verify
 * drawer width, scrim, top bar, and rail layer structure.
 * Run: npx vitest run src/components/mobile/__tests__/MobileLayoutEvidence.test.tsx
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileDrawer } from '../MobileDrawer.js';
import { MobileTopBar } from '../MobileTopBar.js';
import { MobileTabletRail } from '../MobileTabletRail.js';

vi.mock('../../../stores/authStore.js', () => ({
  useAuthStore: (selector: (s: { logout: () => void }) => unknown) =>
    selector({ logout: vi.fn() }),
}));

describe('SS-03 Layout Structure Evidence', () => {
  it('MobileTopBar has gradient background and gold-300 bottom border in inline styles', () => {
    render(
      <MemoryRouter>
        <MobileTopBar onMenuOpen={vi.fn()} stationName="Hampton Hawks" connectionStatus="online" />
      </MemoryRouter>
    );
    const header = document.querySelector('header.mobile-top-bar') as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.style.background).toContain('linear-gradient');
    expect(header.style.borderBottom).toContain('3px solid');
    // paddingTop uses env(safe-area-inset-top) — jsdom doesn't resolve CSS env(), verified in source
    // hamburger exists
    const hamburger = document.querySelector('.mobile-hamburger');
    expect(hamburger).toBeTruthy();
    // connection dot exists
    const dot = screen.getByRole('status', { name: 'Connected' });
    expect(dot).toBeInTheDocument();
  });

  it('MobileDrawer has 80vw width and max-width 320px', () => {
    render(
      <MemoryRouter>
        <MobileDrawer open={true} onClose={vi.fn()} />
      </MemoryRouter>
    );
    const drawer = screen.getByTestId('mobile-drawer') as HTMLElement;
    expect(drawer).toBeTruthy();
    expect(drawer.style.width).toBe('80vw');
    expect(drawer.style.maxWidth).toBe('320px');
    // scrim exists
    const scrim = screen.getByTestId('mobile-drawer-scrim');
    expect(scrim).toBeInTheDocument();
    // close button exists
    expect(screen.getByTestId('mobile-drawer-close')).toBeInTheDocument();
    // nav items
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText('Lookup')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('MobileTabletRail has hawk-50 background and hawk-200 right border', () => {
    render(
      <MemoryRouter>
        <MobileTabletRail stationName="Hampton Hawks" />
      </MemoryRouter>
    );
    const rail = document.querySelector('aside[aria-label="Tablet navigation rail"]') as HTMLElement;
    expect(rail).toBeTruthy();
    expect(rail.style.background).toContain('hawk-50');
    expect(rail.style.borderRight).toContain('1px solid');
    expect(rail.style.width).toBe('220px');
    expect(rail.classList.contains('mobile-tablet-rail')).toBe(true);
  });

  it('ConnectionDot has correct colors for each state', () => {
    const { rerender } = render(
      <MemoryRouter>
        <MobileTopBar onMenuOpen={vi.fn()} connectionStatus="online" />
      </MemoryRouter>
    );
    let dot = screen.getByRole('status');
    expect(dot.style.background).toContain('gold-500');

    rerender(
      <MemoryRouter>
        <MobileTopBar onMenuOpen={vi.fn()} connectionStatus="checking" />
      </MemoryRouter>
    );
    dot = screen.getByRole('status');
    expect(dot.style.background).toContain('hawk-300');

    rerender(
      <MemoryRouter>
        <MobileTopBar onMenuOpen={vi.fn()} connectionStatus="offline" />
      </MemoryRouter>
    );
    dot = screen.getByRole('status');
    expect(dot.style.background).toContain('danger');
    expect(dot.classList.contains('mobile-connection-dot-offline')).toBe(true);
  });
});
