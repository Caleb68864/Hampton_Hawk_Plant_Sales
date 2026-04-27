import { useCallback, useEffect, useRef, useState } from 'react';
import { TouchButton } from '@/components/shared/TouchButton.js';

export interface QuantitySelectorProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Quick preset values rendered as one-tap buttons. Defaults to [3, 5, 10]. */
  presets?: number[];
}

// QuantitySelector — touch-friendly +/- with a prominent multiplier badge,
// a tap-to-type editable input, and quick preset chips (3/5/10).
//
// Drives multi-quantity scanning ("set 7, scan once, fulfill 7"). Parent owns
// `value` (the parent decides whether to reset after a scan).
//
// Touch: 56px min hit target on +/- (TouchButton enforces min-h-14 min-w-14)
//   and on preset chips. The badge is tappable; tapping switches it to a
//   numeric input ready for typing.
// Keyboard: digit keys 1-9 typed at <body> set qty; ESC resets to 1. The
//   handler skips when the active element is an input/textarea/select so the
//   scan input keeps receiving keystrokes from a hardware barcode scanner.
//   In edit mode: type a number, Enter commits, ESC cancels.
// A11y: role="group" + aria-label so screen readers announce the cluster as
//   "Scan quantity"; the badge has aria-live="polite" so updates are spoken.
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  presets = [3, 5, 10],
}: QuantitySelectorProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const isMulti = clamped > 1;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(clamped));
  const inputRef = useRef<HTMLInputElement>(null);

  const decrement = useCallback(() => {
    if (disabled) return;
    onChange(Math.max(min, clamped - 1));
  }, [clamped, disabled, min, onChange]);

  const increment = useCallback(() => {
    if (disabled) return;
    onChange(Math.min(max, clamped + 1));
  }, [clamped, disabled, max, onChange]);

  const setPreset = useCallback(
    (n: number) => {
      if (disabled) return;
      onChange(Math.min(max, Math.max(min, n)));
    },
    [disabled, max, min, onChange],
  );

  const startEditing = useCallback(() => {
    if (disabled) return;
    setDraft(String(clamped));
    setEditing(true);
  }, [clamped, disabled]);

  const commitDraft = useCallback(() => {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
    setEditing(false);
  }, [draft, max, min, onChange]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setDraft(String(clamped));
  }, [clamped]);

  // When entering edit mode, focus + select the input so typing replaces.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Window-level keyboard shortcuts: digits set qty, ESC resets to 1.
  // Skips when focus is in any text-entry control (incl. our own edit input)
  // so neither the ScanInput nor the qty edit input get hijacked.
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (clamped !== 1) {
          e.preventDefault();
          onChange(1);
        }
        return;
      }

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
      className={`flex flex-wrap items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
        isMulti
          ? 'border-gold-400 bg-gold-50'
          : 'border-hawk-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled || clamped === 1}
        aria-label="Reset scan quantity to 1"
        className="min-h-11 min-w-11 rounded-md border-2 border-hawk-200 bg-white px-3 text-sm font-bold text-hawk-700 transition-colors hover:border-gold-300 hover:bg-gold-50 disabled:opacity-40"
      >
        ↺ Reset
      </button>

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

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEditing();
            }
          }}
          className={`min-w-[5rem] rounded-md border-2 border-gold-400 bg-white px-2 py-1 text-center text-3xl font-semibold tabular-nums text-hawk-900 outline-none focus:ring-2 focus:ring-gold-300 ${
            isMulti ? 'text-gold-800' : ''
          }`}
          style={{ fontFamily: "var(--font-display), 'Fraunces', Georgia, serif" }}
          aria-label="Scan quantity (type a number)"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={disabled}
          aria-label={`Scan quantity is ${clamped}. Click to type a different number.`}
          aria-live="polite"
          aria-atomic="true"
          className={`min-w-[5rem] cursor-text rounded-md px-2 py-1 text-center tabular-nums hover:bg-hawk-50 focus:outline-none focus:ring-2 focus:ring-gold-300 ${
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
        </button>
      )}

      <TouchButton
        type="button"
        variant="ghost"
        onClick={increment}
        disabled={disabled || clamped >= max}
        aria-label="Increase scan quantity"
      >
        <span className="text-2xl font-bold leading-none">+</span>
      </TouchButton>

      {presets.length > 0 && (
        <div
          role="group"
          aria-label="Quick quantity presets"
          className="flex items-center gap-2 border-l border-hawk-200 pl-3 ml-1"
        >
          {presets.map((preset) => {
            const presetClamped = Math.min(max, Math.max(min, preset));
            const isActive = clamped === presetClamped;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setPreset(preset)}
                disabled={disabled || preset > max || preset < min}
                aria-label={`Set scan quantity to ${preset}`}
                aria-pressed={isActive}
                className={`min-h-11 min-w-11 rounded-md border-2 px-3 text-sm font-bold tabular-nums transition-colors disabled:opacity-40 ${
                  isActive
                    ? 'border-gold-500 bg-gold-200 text-gold-900'
                    : 'border-hawk-200 bg-white text-hawk-700 hover:border-gold-300 hover:bg-gold-50'
                }`}
              >
                ×{preset}
              </button>
            );
          })}
        </div>
      )}

      <span className="hidden md:inline text-[10px] text-hawk-500">
        Tap ×N to type · 1-9 sets · ESC resets
      </span>
    </div>
  );
}
