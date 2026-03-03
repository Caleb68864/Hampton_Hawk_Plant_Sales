import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface ScanInputHandle {
  focus: () => void;
}

interface ScanInputProps {
  onScan: (barcode: string) => void;
  disabled?: boolean;
}

export const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(
  function ScanInput({ onScan, disabled }, ref) {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);

    const focus = useCallback(() => {
      inputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({ focus }), [focus]);

    useEffect(() => {
      focus();
    }, [focus]);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Escape') {
        setValue('');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = value.trim();
        if (!barcode) return;

        const now = Date.now();
        if (barcode === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
          setValue('');
          return;
        }

        lastScanRef.current = barcode;
        lastScanTimeRef.current = now;
        setValue('');
        onScan(barcode);
      }
    }

    return (
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-lg border-2 border-hawk-500 px-4 py-4 text-2xl font-mono shadow-sm focus:border-hawk-600 focus:outline-none focus:ring-2 focus:ring-hawk-500"
        placeholder="Scan barcode or type SKU..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
      />
    );
  },
);
