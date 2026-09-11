import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface ScanInputHandle {
  focus: () => void;
}

interface ScanInputProps {
  onScan: (barcode: string) => void;
  disabled?: boolean;
}

// True when the element that currently has focus is somewhere the operator is
// typing on purpose (another input, a textarea, a select, contenteditable).
// Keystrokes there belong to that control, not to the scan buffer.
function isTextEntryElement(el: Element | null): boolean {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable === true;
}

export const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(
  function ScanInput({ onScan, disabled }, ref) {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);
    // Latest buffer, readable from the window listener without re-subscribing
    // on every keystroke.
    const valueRef = useRef('');
    const setBuffer = useCallback((next: string) => {
      valueRef.current = next;
      setValue(next);
    }, []);
    const onScanRef = useRef(onScan);
    useEffect(() => {
      onScanRef.current = onScan;
    }, [onScan]);

    const focus = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({ focus }), [focus]);

    useEffect(() => {
      focus();
    }, [focus]);

    const submit = useCallback(() => {
      const barcode = valueRef.current.trim();
      if (!barcode) return;

      const now = Date.now();
      if (barcode === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
        setBuffer('');
        return;
      }

      lastScanRef.current = barcode;
      lastScanTimeRef.current = now;
      setBuffer('');
      onScanRef.current(barcode);
    }, [setBuffer]);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Escape') {
        setBuffer('');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    }

    // Stray-keystroke recapture. A USB-wedge scanner is just a very fast
    // keyboard: if focus has drifted off this input (the operator tapped a
    // quantity preset or an action button, or the input was disabled during the
    // previous scan and refocus has not landed yet) the whole barcode is typed
    // at whatever is focused -- a button swallows it and Enter re-clicks the
    // button. So: any unmodified printable key or Enter that arrives while focus
    // is not in a text-entry control is routed into the scan buffer here.
    useEffect(() => {
      if (disabled) return;

      function handleWindowKeyDown(e: KeyboardEvent) {
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const active = document.activeElement;
        if (active === inputRef.current) return;
        if (isTextEntryElement(active)) return;

        if (e.key === 'Enter') {
          if (!valueRef.current.trim()) return;
          e.preventDefault();
          focus();
          submit();
          return;
        }

        if (e.key.length !== 1) return;
        e.preventDefault();
        setBuffer(valueRef.current + e.key);
        focus();
      }

      window.addEventListener('keydown', handleWindowKeyDown);
      return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, [disabled, focus, setBuffer, submit]);

    return (
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-lg border-2 border-hawk-500 px-4 py-4 text-2xl font-mono shadow-sm focus:border-hawk-600 focus:outline-none focus:ring-2 focus:ring-hawk-500"
        placeholder="Scan barcode or type SKU..."
        value={value}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
      />
    );
  },
);
