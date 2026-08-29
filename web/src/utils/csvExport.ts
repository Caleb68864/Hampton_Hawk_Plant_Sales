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
  const csvContent = buildCsvContent(rows, headers, keys);

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
 * Build the full CSV text (BOM + CRLF-joined rows). Pure, so it can be
 * unit-tested without a DOM.
 */
export function buildCsvContent<T extends Record<string, unknown>>(
  rows: T[],
  headers: string[],
  keys: (keyof T)[]
): string {
  if (headers.length !== keys.length) {
    throw new Error('Headers and keys arrays must be the same length');
  }

  // UTF-8 BOM (U+FEFF) for Excel compatibility
  const BOM = String.fromCharCode(0xfeff);

  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = rows.map((row) =>
    keys.map((key) => escapeCsvField(String(row[key] ?? ''))).join(',')
  );

  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/** A plain number (optionally negative / decimal) is safe to leave as-is. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Leading characters that Excel, LibreOffice and Google Sheets interpret
 * as the start of a formula (or, for tab/CR, as a way to sneak one past a
 * leading-character check).
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escape a field value for CSV.
 *
 * Wraps in quotes if the value contains a comma, quote, or newline, and
 * doubles any internal quotes. Values that would be evaluated as a formula
 * when the file is opened in a spreadsheet (leading = + - @ tab or CR) are
 * prefixed with a single quote and quoted, so a customer named
 * "=HYPERLINK(...)" or a note starting with "-cmd|..." is rendered as text
 * instead of executed. Plain numbers such as -5 are left untouched.
 */
export function escapeCsvField(value: string): string {
  const needsNeutralising = FORMULA_TRIGGER.test(value) && !PLAIN_NUMBER.test(value);
  const safe = needsNeutralising ? `'${value}` : value;
  const needsQuotes = needsNeutralising || /[,"\r\n]/.test(safe);
  if (needsQuotes) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
