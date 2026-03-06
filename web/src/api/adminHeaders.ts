export function buildAdminHeaders(pin: string, reason?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Admin-Pin': pin.trim(),
  };

  const trimmedReason = reason?.trim();
  if (trimmedReason) {
    headers['X-Admin-Reason'] = trimmedReason;
  }

  return headers;
}
