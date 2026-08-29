/**
 * Split one CSV record into its fields, honouring RFC 4180 quoting:
 * a field wrapped in double quotes may contain commas, and a doubled
 * quote inside it stands for one literal quote. Fields are trimmed of
 * surrounding whitespace outside the quotes only.
 *
 * Multi-line quoted fields are not supported; callers that split the file
 * on newlines first will see such a record as two lines, which is the same
 * limitation the previous naive split had, minus the column shifting.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Return the distinct, non-empty values of one column from CSV text.
 * Header matching is case-insensitive. Returns [] when the header is
 * missing or there are no data rows.
 */
export function extractCsvColumnValues(text: string, columnName: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const index = headers.indexOf(columnName.toLowerCase());
  if (index === -1) return [];

  return Array.from(new Set(
    lines.slice(1)
      .map((line) => parseCsvLine(line)[index] ?? '')
      .filter(Boolean),
  ));
}
