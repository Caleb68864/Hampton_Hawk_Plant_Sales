import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileQuickActionCard } from '../MobileQuickActionCard.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderCard(props: Partial<Parameters<typeof MobileQuickActionCard>[0]> = {}) {
  const defaults = {
    id: 'pickup',
    title: 'Pickup',
    description: 'Process plant pickups',
    icon: <span>icon</span>,
    path: '/mobile/pickup',
    enabled: true,
    comingSoon: false,
  };
  return render(
    <MemoryRouter>
      <MobileQuickActionCard {...defaults} {...props} />
    </MemoryRouter>
  );
}

describe('MobileQuickActionCard', () => {
  it('renders title and description', () => {
    renderCard();
    expect(screen.getByText('Pickup')).toBeInTheDocument();
    expect(screen.getByText('Process plant pickups')).toBeInTheDocument();
  });

  it('navigates when clicked on enabled card', () => {
    renderCard({ enabled: true });
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup');
  });

  it('does not navigate when disabled', () => {
    mockNavigate.mockClear();
    renderCard({ enabled: false });
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has aria-disabled="true" when disabled', () => {
    renderCard({ enabled: false });
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-disabled', 'true');
  });

  it('has aria-disabled="true" when comingSoon', () => {
    renderCard({ enabled: true, comingSoon: true });
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows "Coming soon" text when comingSoon', () => {
    renderCard({ enabled: true, comingSoon: true });
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('does not navigate on Enter when disabled', () => {
    mockNavigate.mockClear();
    renderCard({ enabled: false });
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates on Enter when enabled', () => {
    mockNavigate.mockClear();
    renderCard({ enabled: true });
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup');
  });

  it('navigates on Space when enabled', () => {
    mockNavigate.mockClear();
    renderCard({ enabled: true });
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledWith('/mobile/pickup');
  });
});
