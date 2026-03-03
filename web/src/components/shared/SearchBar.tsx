import { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', debounceMs = 300 }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handleChange(v: string) {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounceMs);
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-md border border-gray-300 pl-3 pr-8 py-2 text-sm shadow-sm focus:border-hawk-500 focus:outline-none focus:ring-1 focus:ring-hawk-500"
        placeholder={placeholder}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
      />
      {local && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          onClick={() => { setLocal(''); onChange(''); }}
        >
          x
        </button>
      )}
    </div>
  );
}
