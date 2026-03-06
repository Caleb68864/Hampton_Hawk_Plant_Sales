import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onEnter?: (value: string) => void;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  autoFocus = false,
  inputRef,
  onEnter,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      inputRef?.current?.focus();
    }
  }, [autoFocus, inputRef]);

  function handleChange(v: string) {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounceMs);
  }

  function handleSubmit() {
    clearTimeout(timer.current);
    onChange(local);
    onEnter?.(local);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-md border border-gray-300 pl-3 pr-20 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
        placeholder={placeholder}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setLocal('');
            onChange('');
          }
        }}
        autoFocus={autoFocus}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {local && (
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => {
              clearTimeout(timer.current);
              setLocal('');
              onChange('');
              inputRef?.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
