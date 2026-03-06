export function buildPrintOrderPath(orderId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo?.startsWith('/')) {
    params.set('returnTo', returnTo);
  }

  const query = params.toString();
  return `/print/order/${orderId}${query ? `?${query}` : ''}`;
}

export function buildPrintSellerPacketPath(sellerId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo?.startsWith('/')) {
    params.set('returnTo', returnTo);
  }

  const query = params.toString();
  return `/print/seller/${sellerId}${query ? `?${query}` : ''}`;
}

export function resolvePrintReturnTo(value: string | null, fallback: string): string {
  return value?.startsWith('/') ? value : fallback;
}
