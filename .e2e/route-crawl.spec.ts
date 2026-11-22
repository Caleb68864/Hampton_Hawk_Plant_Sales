/**
 * Route crawl: every route declared in web/src/App.tsx is opened in Chromium
 * by a signed-in admin, and fails the run if a page
 *   - throws (an uncaught exception or unhandled rejection: there is no error
 *     boundary, so a render crash leaves an empty #root),
 *   - gets a 5xx from /api while it loads,
 *   - renders the 404 page, or
 *   - lands somewhere other than where it was sent (e.g. /login, access denied).
 * Rebuilds the route sweep from the 08-29 harness (docs/improve/
 * 2026-08-29-sweep-report.md, "End-to-end harness"), which was never tracked.
 *
 * The first test reads App.tsx and fails when a route is added or renamed
 * without an entry in ROUTES below, so the crawl cannot quietly fall behind.
 *
 * Same stack, env and credentials as sale-day.spec.ts (see its header). One
 * login per run (CI's compose job keeps total logins under the 10/min limiter).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (see the header of sale-day.spec.ts).`);
  return value;
}

// Playwright loads this spec as CommonJS (no "type": "module" in package.json).
const APP_TSX = resolve(__dirname, '../web/src/App.tsx');
const RUN = `C${Date.now().toString().slice(-6)}`;

interface Fixtures {
  plantId: string;
  customerId: string;
  sellerId: string;
  orderId: string;
  draftId: string;
  sessionId: string;
}

interface RouteEntry {
  /** Route pattern as App.tsx composes it ('' is the root index). */
  pattern: string;
  url: (f: Fixtures) => string;
  /** Where the page should end up, when it redirects on purpose. */
  expectPath?: RegExp;
}

const ROUTES: RouteEntry[] = [
  { pattern: '', url: () => '/' },
  { pattern: 'connect-mobile', url: () => '/connect-mobile' },
  { pattern: 'settings', url: () => '/settings' },
  { pattern: 'admin/users', url: () => '/admin/users' },
  { pattern: 'plants', url: () => '/plants' },
  { pattern: 'plants/:id', url: (f) => `/plants/${f.plantId}` },
  { pattern: 'inventory', url: () => '/inventory' },
  { pattern: 'customers', url: () => '/customers' },
  { pattern: 'customers/:id', url: (f) => `/customers/${f.customerId}` },
  { pattern: 'sellers', url: () => '/sellers' },
  { pattern: 'sellers/:id', url: (f) => `/sellers/${f.sellerId}` },
  { pattern: 'orders', url: () => '/orders' },
  { pattern: 'orders/new', url: () => '/orders/new' },
  { pattern: 'orders/:id/edit', url: (f) => `/orders/${f.orderId}/edit` },
  { pattern: 'orders/:id', url: (f) => `/orders/${f.orderId}` },
  { pattern: 'station', url: () => '/station' },
  { pattern: 'pickup', url: () => '/pickup' },
  { pattern: 'pickup/session/:id', url: (f) => `/pickup/session/${f.sessionId}` },
  { pattern: 'pickup/:orderId', url: (f) => `/pickup/${f.orderId}` },
  { pattern: 'lookup-print', url: () => '/lookup-print' },
  { pattern: 'walkup/new', url: () => '/walkup/new', expectPath: /^\/walkup\/register/ },
  { pattern: 'walkup/register', url: () => '/walkup/register', expectPath: /^\/walkup\/register/ },
  { pattern: 'walkup/register/new', url: () => '/walkup/register/new', expectPath: /^\/walkup\/register/ },
  { pattern: 'walkup/register/:draftId', url: (f) => `/walkup/register/${f.draftId}` },
  { pattern: 'imports', url: () => '/imports' },
  { pattern: 'reports', url: () => '/reports' },
  { pattern: 'reports/live-sale-kpi', url: () => '/reports/live-sale-kpi' },
  { pattern: 'reports/leftover-inventory', url: () => '/reports/leftover-inventory' },
  { pattern: 'reports/sales-by-seller', url: () => '/reports/sales-by-seller' },
  { pattern: 'reports/sales-by-customer', url: () => '/reports/sales-by-customer' },
  { pattern: 'reports/sales-by-plant', url: () => '/reports/sales-by-plant' },
  { pattern: 'reports/daily-sales', url: () => '/reports/daily-sales' },
  { pattern: 'reports/payment-breakdown', url: () => '/reports/payment-breakdown' },
  { pattern: 'reports/walkup-vs-preorder', url: () => '/reports/walkup-vs-preorder' },
  { pattern: 'reports/status-funnel', url: () => '/reports/status-funnel' },
  { pattern: 'reports/top-movers', url: () => '/reports/top-movers' },
  { pattern: 'reports/outstanding-aging', url: () => '/reports/outstanding-aging' },
  { pattern: 'docs', url: () => '/docs' },
  { pattern: 'print/order/:orderId', url: (f) => `/print/order/${f.orderId}` },
  { pattern: 'print/order-barcodes/:orderId', url: (f) => `/print/order-barcodes/${f.orderId}` },
  { pattern: 'print/order-barcodes', url: (f) => `/print/order-barcodes?ids=${f.orderId}` },
  { pattern: 'print/orders', url: (f) => `/print/orders?ids=${f.orderId}` },
  { pattern: 'print/seller/:sellerId', url: (f) => `/print/seller/${f.sellerId}` },
  { pattern: 'print/sellers', url: (f) => `/print/sellers?ids=${f.sellerId}` },
  { pattern: 'print/customer/:customerId', url: (f) => `/print/customer/${f.customerId}` },
  { pattern: 'print/customers', url: (f) => `/print/customers?ids=${f.customerId}` },
  { pattern: 'print/cheatsheet/pickup', url: () => '/print/cheatsheet/pickup' },
  { pattern: 'print/cheatsheet/lookup', url: () => '/print/cheatsheet/lookup' },
  { pattern: 'print/cheatsheet/admin', url: () => '/print/cheatsheet/admin' },
  { pattern: 'print/cheatsheet/end-of-day', url: () => '/print/cheatsheet/end-of-day' },
  { pattern: 'print/cheatsheet/thermal-labels', url: () => '/print/cheatsheet/thermal-labels' },
  { pattern: 'print/labels', url: (f) => `/print/labels?ids=${f.plantId}` },
  { pattern: 'mobile/access-denied', url: () => '/mobile/access-denied' },
  { pattern: 'mobile', url: () => '/mobile' },
  { pattern: 'mobile/pickup', url: () => '/mobile/pickup' },
  { pattern: 'mobile/pickup/:orderId', url: (f) => `/mobile/pickup/${f.orderId}` },
  { pattern: 'mobile/lookup', url: () => '/mobile/lookup' },
  { pattern: 'mobile/scanner-demo', url: () => '/mobile/scanner-demo' },
  { pattern: 'mobile/account', url: () => '/mobile/account' },
];

/** Declared in App.tsx but deliberately not crawled, with the reason. */
const NOT_CRAWLED: Record<string, string> = {
  login: 'covered by every sale-day.spec.ts test; opening it signed in would only test the redirect',
  '*': 'the 404 catch-all; the crawl asserts no other route renders it',
};

/**
 * Route patterns declared in App.tsx, composed through nested <Route>s.
 * A plain regex walk, not a TSX parser:
 * a <Route> tag's attributes may hold one level of nested JSX (element={<X />}).
 */
function declaredRoutes(source: string): string[] {
  const tag = /<Route\b((?:[^<>]|<[^>]*>)*?)(\/?)>|<\/Route>/g;
  const stack: (string | null)[] = [];
  const out: string[] = [];
  const prefix = () => stack.filter((s): s is string => !!s).join('/');
  for (const m of source.matchAll(tag)) {
    if (m[0] === '</Route>') {
      stack.pop();
      continue;
    }
    const attrs = m[1];
    const path = /\bpath="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const isIndex = /\bindex\b/.test(attrs);
    const hasElement = /\belement=/.test(attrs);
    const selfClosing = m[2] === '/';
    if (isIndex) out.push(prefix());
    else if (path !== null && hasElement) out.push([prefix(), path].filter(Boolean).join('/'));
    if (!selfClosing) stack.push(path);
  }
  return out;
}

test('every App.tsx route is in the crawl list', () => {
  const declared = declaredRoutes(readFileSync(APP_TSX, 'utf8'));
  expect(declared.length, 'App.tsx parse found no routes').toBeGreaterThan(40);
  const listed = new Set([...ROUTES.map((r) => r.pattern), ...Object.keys(NOT_CRAWLED)]);
  const missing = declared.filter((p) => !listed.has(p));
  const stale = ROUTES.map((r) => r.pattern).filter((p) => !declared.includes(p));
  expect(missing, 'routes in App.tsx with no ROUTES entry in route-crawl.spec.ts').toEqual([]);
  expect(stale, 'ROUTES entries no longer declared in App.tsx').toEqual([]);
});

async function api<T>(req: APIRequestContext, method: string, url: string, data?: unknown): Promise<T> {
  const res = await req.fetch(`/api${url}`, { method, data });
  const body = await res.json().catch(() => null);
  expect(res.status(), `${method} ${url}: ${JSON.stringify(body)}`).toBe(200);
  return body.data as T;
}

async function seed(req: APIRequestContext): Promise<Fixtures> {
  const plant = await api<{ id: string }>(req, 'POST', '/plants', {
    sku: `CRAWL${RUN}`, name: `Crawl Plant ${RUN}`, price: 6, barcode: `8${RUN.slice(1)}00000`, isActive: true,
  });
  await api(req, 'PUT', `/inventory/${plant.id}`, { onHandQty: 5, reason: 'e2e crawl seed' });
  const seller = await api<{ id: string }>(req, 'POST', '/sellers', { displayName: `Crawl Seller ${RUN}` });
  const customer = await api<{ id: string; picklistBarcode: string }>(req, 'POST', '/customers', {
    displayName: `Crawl Customer ${RUN}`, phone: '5555550199',
  });
  const order = await api<{ id: string }>(req, 'POST', '/orders', {
    customerId: customer.id, sellerId: seller.id, isWalkUp: false,
    lines: [{ plantCatalogId: plant.id, qtyOrdered: 1 }],
  });
  const draft = await api<{ id: string }>(req, 'POST', '/walkup-register/draft', { workstationName: 'e2e-crawl' });
  const session = await api<{ id: string }>(req, 'POST', '/scan-sessions', {
    scannedBarcode: customer.picklistBarcode, workstationName: 'e2e-crawl',
  });
  return { plantId: plant.id, customerId: customer.id, sellerId: seller.id, orderId: order.id, draftId: draft.id, sessionId: session.id };
}

async function settle(page: Page) {
  // Some pages poll (live KPI, connection status); networkidle still settles
  // between polls, and a page that never goes idle is checked as it stands.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

test('every route renders without a crash, a 5xx or the 404 page', async ({ page }) => {
  test.setTimeout(ROUTES.length * 15_000);
  // Print pages call window.print() on load; make it a no-op so nothing blocks.
  await page.addInitScript(() => { window.print = () => undefined; });

  await page.goto('/login');
  await page.locator('#username').fill(required('E2E_ADMIN_USER'));
  await page.locator('#password').fill(required('E2E_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);

  const fixtures = await seed(page.request);

  let current = '';
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`${current}: uncaught ${e.message}`));
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/') && r.status() >= 500) {
      problems.push(`${current}: ${r.request().method()} ${u.pathname}${u.search} -> ${r.status()}`);
    }
  });

  for (const route of ROUTES) {
    current = route.pattern || '/';
    const url = route.url(fixtures);
    await page.goto(url);
    await settle(page);

    const finalPath = new URL(page.url()).pathname;
    const wanted = route.expectPath ?? new RegExp(`^${url.split('?')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    if (!wanted.test(finalPath)) problems.push(`${current}: ended on ${finalPath}, expected ${wanted}`);
    if (await page.getByRole('heading', { name: 'Page not found' }).count()) problems.push(`${current}: rendered the 404 page`);
    const rootText = (await page.locator('#root').innerText().catch(() => '')).trim();
    if (!rootText) problems.push(`${current}: #root is empty`);
  }

  expect(problems, `${problems.length} problem(s) across ${ROUTES.length} routes`).toEqual([]);
});
