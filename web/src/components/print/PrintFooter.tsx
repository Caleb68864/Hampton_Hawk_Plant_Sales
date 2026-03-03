interface PrintFooterProps {
  showNotesLines?: boolean;
  notesLineCount?: number;
}

export function PrintFooter({ showNotesLines = true, notesLineCount = 3 }: PrintFooterProps) {
  return (
    <div className="mt-8">
      {showNotesLines && (
        <div className="mb-6">
          <p className="font-semibold text-sm mb-2">Notes:</p>
          {Array.from({ length: notesLineCount }).map((_, i) => (
            <div key={i} className="border-b border-gray-400 h-8" />
          ))}
        </div>
      )}
      <div className="text-center text-xs text-gray-500 border-t border-gray-300 pt-2 mt-4">
        Powered by Logic NE
      </div>
    </div>
  );
}
