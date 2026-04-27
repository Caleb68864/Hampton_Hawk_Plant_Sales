import { useCallback, useEffect } from 'react';
import { TouchButton } from '@/components/shared/TouchButton.js';

export interface QuantitySelectorProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

// QuantitySelector — touch-friendly +/- with a prominent multiplier badge.
// Drives multi-quantity scanning ("set 6, scan once, fulfill 6"). Sticky:
// the parent owns `value`, so the selector never auto-resets after a scan.
//
// Touch: 56px min hit target on +/- (TouchButton enforces min-h-14 min-w-14).
// Keyboard: digit keys 1-9 typed at <body> set qty; ESC resets to 1. The
//   handler skips when the active element is an input/textarea/select so the
//   scan input keeps receiving keystrokes from a hardware barcode scanner.
// Mouse: standard click handlers on the buttons.
// A11y: role="group" + aria-label so screen readers announce the cluster as
//   "Scan quantity"; the badge has aria-live="polite" so updates are spoken.
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: QuantitySelectorProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const isMulti = clamped > 1;

  const decrement = useCallback(() => {
    if (disabled) return;
    onChange(Math.max(min, clamped - 1));
  }, [clamped, disabled, min, onChange]);

  const increment = useCallback(() => {
    if (disabled) return;
    onChange(Math.min(max, clamped + 1));
  }, [clamped, disabled, max, onChange]);

  // Keyboard shortcuts at the window level. Skips when focus is in any
  // text-entry control so the ScanInput keeps catching scanner output.
  useEffect(() => {
    if (disabled) return;

    function isTextEntryFocused(): boolean {
      const active = document.activeElement;
      if (!active || active === document.body) return false;
      const tag = active.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if ((active as HTMLElement).isContentEditable) return true;
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTextEntryFocused()) return;
      // Don't interfere with modifier-combo shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (clamped !== 1) {
          e.preventDefault();
          onChange(1);
        }
        return;
      }

      // Digit shortcuts: 1-9 set the qty directly.
      if (e.key >= '1' && e.key <= '9') {
        const digit = Number(e.key);
        const next = Math.min(max, Math.max(min, digit));
        e.preventDefault();
        onChange(next);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clamped, disabled, max, min, onChange]);

  return (
    <div
      role="group"
      aria-label="Scan quantity"
      className={`flex items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
        isMulti
          ? 'border-gold-400 bg-gold-50'
          : 'border-hawk-200 bg-white'
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-hawk-700">
        Scan qty
      </span>

      <TouchButton
        type="button"
        variant="ghost"
        onClick={decrement}
        disabled={disabled || clamped <= min}
        aria-label="Decrease scan quantity"
      >
        <span className="text-2xl font-bold leading-none">−</span>
      </TouchButton>

      <div
        aria-live="polite"
        aria-atomic="true"
        className={`min-w-[5rem] text-center tabular-nums select-none ${
          isMulti ? 'text-gold-800' : 'text-hawk-900'
        }`}
        style={{ fontFamily: "var(--font-display), 'Fraunces', Georgia, serif" }}
      >
        <span className={`block ${isMulti ? 'text-4xl font-bold' : 'text-3xl font-semibold'}`}>
          ×{clamped}
        </span>
        {isMulti && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-700">
            Multi-mode
          </span>
        )}
      </div>

      <TouchButton
        type="button"
        variant="ghost"
        onClick={increment}
        disabled={disabled || clamped >= max}
        aria-label="Increase scan quantity"
      >
        <span className="text-2xl font-bold leading-none">+</span>
      </TouchButton>

      <span className="hidden sm:inline text-[10px] text-hawk-500">
        Tip: press 1-9 to set, ESC to reset
      </span>
    </div>
  );
}
