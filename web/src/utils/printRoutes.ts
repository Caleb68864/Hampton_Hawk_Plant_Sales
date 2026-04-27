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

export function buildPrintCustomerPickListPath(customerId: string, returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo?.startsWith('/')) {
    params.set('returnTo', returnTo);
  }

  const query = params.toString();
  return `/print/customer/${customerId}${query ? `?${query}` : ''}`;
}

export function buildPrintSellersBatchPath(sellerIds: string[], returnTo?: string): string {
  const params = new URLSearchParams();
  params.set('ids', sellerIds.join(','));
  if (returnTo?.startsWith('/')) {
    params.set('returnTo', returnTo);
  }
  return `/print/sellers?${params.toString()}`;
}

export function buildPrintCustomersBatchPath(customerIds: string[], returnTo?: string): string {
  const params = new URLSearchParams();
  params.set('ids', customerIds.join(','));
  if (returnTo?.startsWith('/')) {
    params.set('returnTo', returnTo);
  }
  return `/print/customers?${params.toString()}`;
}

export function resolvePrintReturnTo(value: string | null, fallback: string): string {
  return value?.startsWith('/') ? value : fallback;
}
