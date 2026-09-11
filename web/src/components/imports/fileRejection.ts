/** Hard ceiling for a single import upload. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns a human-readable reason the file is not acceptable, or null.
 * Kept DOM-free so it can be unit-tested and reused.
 */
export function describeFileRejection(
  file: { name: string; size: number },
  allowedExtensions: string[],
  maxBytes: number = MAX_UPLOAD_BYTES,
): string | null {
  const ext = file.name.includes('.') ? (file.name.split('.').pop() ?? '').toLowerCase() : '';
  if (!ext || !allowedExtensions.includes(ext)) {
    const allowed = allowedExtensions.map((e) => `.${e}`).join(' or ');
    return `Only ${allowed} files are accepted${ext ? ` (got .${ext})` : ''}.`;
  }
  if (file.size > maxBytes) {
    return `File is ${formatMb(file.size)}; the limit is ${formatMb(maxBytes)}.`;
  }
  return null;
}
