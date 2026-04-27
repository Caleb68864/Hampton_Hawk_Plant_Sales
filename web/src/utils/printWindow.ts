/**
 * Opens a print URL in a new window/tab. Returns true if the window opened
 * successfully, false if the popup was blocked. Callers should surface a
 * "Allow pop-ups" hint to the user when this returns false.
 */
export function openPrintWindow(url: string): boolean {
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
  return printWindow !== null;
}
