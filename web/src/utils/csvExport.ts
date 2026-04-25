/**
 * Export data to a CSV file with UTF-8 BOM for Excel compatibility.
 *
 * @param filename - The name of the file to download (should end in .csv)
 * @param rows - Array of objects representing rows of data
 * @param headers - Array of column header labels (order determines column order)
 * @param keys - Array of object keys corresponding to the headers (same length as headers)
 */
export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  headers: string[],
  keys: (keyof T)[]
): void {
  if (headers.length !== keys.length) {
    throw new Error('Headers and keys arrays must be the same length');
  }

  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';

  // Build header row
  const headerRow = headers.map(escapeField).join(',');

  // Build data rows
  const dataRows = rows.map((row) =>
    keys.map((key) => escapeField(String(row[key] ?? ''))).join(',')
  );

  // Combine with newlines
  const csvContent = BOM + [headerRow, ...dataRows].join('\r\n');

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape a field value for CSV.
 * Wraps in quotes if contains comma, quote, or newline.
 * Doubles any internal quotes.
 */
function escapeField(value: string): string {
  const needsQuotes = /[,"\r\n]/.test(value);
  if (needsQuotes) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
