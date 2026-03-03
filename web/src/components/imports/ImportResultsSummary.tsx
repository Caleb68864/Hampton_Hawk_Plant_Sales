interface ImportResultsSummaryProps {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
}

export function ImportResultsSummary({ totalRows, importedCount, skippedCount }: ImportResultsSummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
        <p className="text-2xl font-bold text-gray-900">{totalRows}</p>
        <p className="text-sm text-gray-500">Total Rows</p>
      </div>
      <div className="bg-white rounded-lg border border-green-200 p-4 text-center">
        <p className="text-2xl font-bold text-green-600">{importedCount}</p>
        <p className="text-sm text-gray-500">Imported</p>
      </div>
      <div className={`bg-white rounded-lg border p-4 text-center ${skippedCount > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
        <p className={`text-2xl font-bold ${skippedCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{skippedCount}</p>
        <p className="text-sm text-gray-500">Skipped</p>
      </div>
    </div>
  );
}
