import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileDrawer } from '../MobileDrawer.js';

vi.mock('../../../stores/authStore.js', () => ({
  useAuthStore: (selector: (s: { logout: () => void }) => unknown) =>
    selector({ logout: vi.fn() }),
}));

function renderDrawer(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <MobileDrawer open={open} onClose={onClose} />
    </MemoryRouter>
  );
}

describe('MobileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nav items when open', () => {
    renderDrawer(true);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText('Lookup')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    fireEvent.click(screen.getByTestId('mobile-drawer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    fireEvent.click(screen.getByTestId('mobile-drawer-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render scrim when closed', () => {
    renderDrawer(false);
    expect(screen.queryByTestId('mobile-drawer-scrim')).not.toBeInTheDocument();
  });

  it('does not call onClose on Escape when drawer is closed', () => {
    const onClose = vi.fn();
    renderDrawer(false, onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
