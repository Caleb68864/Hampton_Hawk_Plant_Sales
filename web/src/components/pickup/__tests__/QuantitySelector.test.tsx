import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuantitySelector } from '../QuantitySelector.js';

describe('QuantitySelector keyboard handling', () => {
  afterEach(() => cleanup());

  it('does not treat window-level digit keys as a quantity shortcut', () => {
    const onChange = vi.fn();
    render(<QuantitySelector value={1} onChange={onChange} />);

    // Focus drifts to a preset button (as it does after a tap), then a wedge
    // scanner types a barcode. None of those digits may become the quantity.
    screen.getByLabelText('Set scan quantity to 3').focus();
    for (const ch of '000000000047') {
      fireEvent.keyDown(window, { key: ch });
    }
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(window, { key: '7' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('still resets to 1 on ESC when focus is not in a text control', () => {
    const onChange = vi.fn();
    render(<QuantitySelector value={5} onChange={onChange} />);
    (document.activeElement as HTMLElement | null)?.blur();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('sets quantity from the preset buttons', () => {
    const onChange = vi.fn();
    render(<QuantitySelector value={1} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Set scan quantity to 5'));

    expect(onChange).toHaveBeenCalledWith(5);
  });
});
