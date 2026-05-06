import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Checkbloom } from '../joy/Checkbloom.js';

const mockAnnounce = vi.fn();

vi.mock('../joy/JoyAriaLive.js', () => ({
  useJoyAnnounce: () => mockAnnounce,
}));

describe('Checkbloom', () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
  });

  it('renders when visible=true', () => {
    render(<Checkbloom visible itemName="Hydrangea" remaining={3} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders correct aria-label', () => {
    render(<Checkbloom visible itemName="Rose" remaining={5} />);
    const badge = screen.getByRole('img');
    expect(badge).toHaveAttribute('aria-label', 'Rose accepted, 5 remaining');
  });

  it('does not render when visible=false', () => {
    render(<Checkbloom visible={false} itemName="Tulip" remaining={0} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('calls useJoyAnnounce with correct message on mount when visible=true', () => {
    render(<Checkbloom visible itemName="Sunflower" remaining={2} />);
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Sunflower accepted, 2 remaining',
      { politeness: 'polite' }
    );
  });

  it('does not call useJoyAnnounce when visible=false', () => {
    render(<Checkbloom visible={false} itemName="Lily" remaining={0} />);
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it('uses default itemName and remaining when not provided', () => {
    render(<Checkbloom visible />);
    expect(mockAnnounce).toHaveBeenCalledWith(
      'Item accepted, 0 remaining',
      { politeness: 'polite' }
    );
  });
});
