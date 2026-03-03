import { useAzHotkeys } from '@/hooks/useAzHotkeys.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface AzTabsProps {
  selected: string | null;
  onSelect: (letter: string | null) => void;
}

export function AzTabs({ selected, onSelect }: AzTabsProps) {
  useAzHotkeys((letter) => onSelect(letter === selected ? null : letter));

  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={`px-2 py-1 text-xs font-medium rounded ${
          selected === null ? 'bg-hawk-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {LETTERS.map((letter) => (
        <button
          key={letter}
          type="button"
          className={`px-2 py-1 text-xs font-medium rounded ${
            selected === letter ? 'bg-hawk-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => onSelect(letter === selected ? null : letter)}
        >
          {letter}
        </button>
      ))}
      <button
        type="button"
        className={`px-2 py-1 text-xs font-medium rounded ${
          selected === '#' ? 'bg-hawk-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onSelect(selected === '#' ? null : '#')}
      >
        #
      </button>
    </div>
  );
}
