/**
 * Sale-day browser E2E: login, pickup lookup + scan, walk-up register (scan,
 * scan past walk-up availability, Manager Override with the PIN, close), void a
 * line + cancel a draft, and moving a walk-up line to another plant.
 *
 * Runs against a live stack (see docs/improve/2026-08-29-sweep-report.md,
 * "End-to-end harness"): Postgres 16, `dotnet run` API, the production web
 * bundle under `vite preview` proxying /api to the API. Expects a fresh
 * database with the bootstrap admin, APP_ADMIN_PIN, and
 * Session__AllowInsecureCookieOverHttp=true (plain http).
 *
 * Env (required): E2E_ADMIN_USER, E2E_ADMIN_PASSWORD, E2E_ADMIN_PIN, matching
 * the API's bootstrap admin and APP_ADMIN_PIN. Optional: E2E_BASE_URL (default
 * http://127.0.0.1:5187), E2E_SHOT_DIR (default test-results/shots). No
 * credentials are written in this file.
 *
 * Stack used on 2026-11-16 (ports from the 08-29 report):
 *   Postgres 16 in Docker on 5439 (password from your environment)
 *   API: ASPNETCORE_URLS=http://127.0.0.1:5289, ConnectionStrings__Default to 5439,
 *        APP_ADMIN_PIN, Bootstrap__AdminUsername/Password,
 *        Session__AllowInsecureCookieOverHttp=true, `dotnet run`
 *   web: `npm run build`, then `vite preview` on 127.0.0.1:5187 with
 *        preview.proxy '/api' -> http://127.0.0.1:5289
 *   npx playwright test -c .e2e/playwright.config.ts  (@playwright/test 1.59)
 * Five logins per run: the login limiter allows 10/min per IP, so wait a minute
 * between back-to-back runs.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (see the header of this file).`);
  return value;
}

const USER = required('E2E_ADMIN_USER');
const PASSWORD = required('E2E_ADMIN_PASSWORD');
const PIN = required('E2E_ADMIN_PIN');
const SHOTS = process.env.E2E_SHOT_DIR ?? 'test-results/shots';
const RUN = Date.now().toString().slice(-6);

test.describe.configure({ mode: 'serial' });

interface Plant { id: string; sku: string; barcode: string; name: string }
const plants: Record<'a' | 'b' | 'c', Plant> = {} as never;
let preorderId = '';
let customerName = '';
let pickupCode = '';

const consoleErrors: string[] = [];

async function api<T>(req: APIRequestContext, method: string, url: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await req.fetch(`/api${url}`, { method, data, headers });
  const body = await res.json().catch(() => null);
  expect(res.status(), `${method} ${url}: ${JSON.stringify(body)}`).toBe(200);
  return body.data as T;
}

async function onHand(req: APIRequestContext, plantId: string): Promise<number> {
  const list = await api<{ onHandQty: number }[] | { items: { plantCatalogId: string; onHandQty: number }[] }>(req, 'GET', `/inventory?pageSize=200`);
  const rows = Array.isArray(list) ? list : list.items;
  return (rows as { plantCatalogId: string; onHandQty: number }[]).find((r) => r.plantCatalogId === plantId)!.onHandQty;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function scan(page: Page, value: string) {
  const input = page.getByPlaceholder('Scan barcode or type SKU...');
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}

async function pin(page: Page, reason: string) {
  await page.locator('#admin-pin').fill(PIN);
  const reasonBox = page.locator('#admin-reason');
  if (await reasonBox.count()) await reasonBox.fill(reason);
  await page.locator('form button[type="submit"]').click();
}

test.beforeEach(({ page }) => {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${test.info().title}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${test.info().title}] pageerror ${e.message}`));
});

test.afterAll(() => {
  console.log(`CONSOLE ERRORS (${consoleErrors.length}):\n${consoleErrors.join('\n')}`);
});

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#username').fill(USER);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('login', async ({ page }) => {
  await login(page);
  await shot(page, '01-after-login');
  const me = await api<{ username: string }>(page.request, 'GET', '/auth/me');
  expect(me.username).toBe(USER);

  // Seed: three plants; B has on-hand 3 with 2 promised to a preorder, so
  // walk-up availability is 1.
  const mk = async (key: 'a' | 'b' | 'c', price: number, qty: number) => {
    const sku = `E2E${key.toUpperCase()}${RUN}`;
    const barcode = `9${RUN}${'abc'.indexOf(key)}0000`.slice(0, 12);
    const p = await api<Plant>(page.request, 'POST', '/plants', { sku, name: `E2E Plant ${key.toUpperCase()} ${RUN}`, price, barcode, isActive: true });
    await api(page.request, 'PUT', `/inventory/${p.id}`, { onHandQty: qty, reason: 'e2e seed' });
    plants[key] = { ...p, barcode };
  };
  await mk('a', 5, 10);
  await mk('b', 3, 3);
  await mk('c', 4, 5);
  // Letters only: 6+ chars with a digit is treated as an order-number scan.
  customerName = `Pickup Tester ${RUN.replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)])}`;
  pickupCode = `PK${RUN.slice(0, 4)}`; // letters + digits, like a generated code
  const cust = await api<{ id: string }>(page.request, 'POST', '/customers', { displayName: customerName, phone: '5555550100', pickupCode });
  const order = await api<{ id: string }>(page.request, 'POST', '/orders', {
    customerId: cust.id,
    isWalkUp: false,
    lines: [
      { plantCatalogId: plants.a.id, qtyOrdered: 2 },
      { plantCatalogId: plants.b.id, qtyOrdered: 2 },
    ],
  });
  preorderId = order.id;
});

test('pickup lookup and scan', async ({ page }) => {
  await login(page);
  await page.goto('/pickup');
  await page.getByPlaceholder(/Scan order sheet barcode/).fill(customerName);
  await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, '02-pickup-lookup');

  // Typing the customer's pickup code finds the order. Generated codes are six
  // characters from A-Z/2-9, so most contain a digit, which the order-number
  // heuristic used to claim ("No order found") while hiding the customer rows.
  await page.goto('/pickup');
  await page.getByPlaceholder(/Scan order sheet barcode/).fill(pickupCode);
  await page.waitForTimeout(1500); // debounce + lookup settle; the bug showed after it
  await expect(page.getByText(/Looking up order|Searching/)).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText(/No order found/)).toBeHidden();
  await expect(page.getByText(customerName).first()).toBeVisible();
  await shot(page, '02b-pickup-lookup-by-code');
  await page.goto(`/pickup/${preorderId}`);
  await expect(page.getByText(plants.a.name).first()).toBeVisible();
  await scan(page, plants.a.barcode);
  await expect.poll(async () => {
    const o = await api<{ lines: { plantCatalogId: string; qtyFulfilled: number }[] }>(page.request, 'GET', `/orders/${preorderId}`);
    return o.lines.find((l) => l.plantCatalogId === plants.a.id)!.qtyFulfilled;
  }).toBe(1);
  await shot(page, '03-pickup-scanned');
  // Attribution (PR #79): the fulfillment event records the signed-in account.
  const events = await api<unknown>(page.request, 'GET', `/orders/${preorderId}/events`).catch(() => null);
  if (events) console.log('pickup events:', JSON.stringify(events).slice(0, 600));
});

test('walk-up register: scan, over-availability, manager override, close', async ({ page }) => {
  await login(page);
  await page.goto('/walkup/register/new');
  await expect(page.getByText(/Draft: .*\d/)).toBeVisible();
  await scan(page, plants.a.barcode);
  await expect(page.getByRole('cell', { name: plants.a.name })).toBeVisible();
  await scan(page, plants.b.barcode); // uses the 1 available
  await expect(page.getByRole('cell', { name: plants.b.name })).toBeVisible();
  await shot(page, '04-register-scanned');

  await page.waitForTimeout(2100); // ScanInput drops identical barcodes within 2 s
  await scan(page, plants.b.barcode); // past walk-up availability
  const override = page.getByRole('button', { name: 'Manager Override' });
  await expect(override).toBeVisible();
  await shot(page, '05-register-over-availability');
  await override.click();
  await pin(page, 'e2e override');
  await expect(override).toBeHidden();
  await expect(page.getByText(/Items: 3/)).toBeVisible();
  await shot(page, '06-register-after-override');
  expect(await onHand(page.request, plants.b.id)).toBe(1); // register decrements at scan time

  const draftId = page.url().split('/').pop()!;
  await page.getByRole('button', { name: 'Close Sale' }).first().click();
  await page.getByRole('dialog').locator('input[type="number"]').fill('20');
  await shot(page, '07-register-close-modal');
  await page.getByRole('button', { name: 'Confirm Close' }).click();
  await expect(page).not.toHaveURL(new RegExp(draftId + '$'), { timeout: 10_000 });
  await shot(page, '08-register-closed');
  const closed = await api<{ status: string; lines: { plantCatalogId: string; qtyOrdered: number; qtyFulfilled: number }[] }>(page.request, 'GET', `/orders/${draftId}`);
  expect(closed.status).toBe('Complete');
  expect(closed.lines.find((l) => l.plantCatalogId === plants.b.id)!.qtyFulfilled).toBe(2);
  expect(await onHand(page.request, plants.b.id)).toBe(1);
});

test('void a line and cancel a draft', async ({ page }) => {
  await login(page);
  const beforeA = await onHand(page.request, plants.a.id);
  const beforeC = await onHand(page.request, plants.c.id);
  await page.goto('/walkup/register/new');
  await expect(page.getByText(/Draft: .*\d/)).toBeVisible();
  await scan(page, plants.a.barcode);
  await expect(page.getByRole('cell', { name: plants.a.name })).toBeVisible();
  await scan(page, plants.c.barcode);
  await expect(page.getByRole('cell', { name: plants.c.name })).toBeVisible();
  await shot(page, '09-void-before');
  await page.getByRole('row', { name: new RegExp(plants.a.name) }).getByRole('button', { name: 'Void' }).click();
  await pin(page, 'e2e void');
  await expect(page.getByRole('cell', { name: plants.a.name })).toBeHidden();
  await shot(page, '10-void-after');
  expect(await onHand(page.request, plants.a.id)).toBe(beforeA);

  const draftId = page.url().split('/').pop()!;
  await page.getByRole('button', { name: 'Cancel Sale' }).click();
  await pin(page, 'e2e cancel');
  await expect(page).toHaveURL(/\/station$/);
  await shot(page, '11-cancelled');
  // Cancel soft-deletes the draft, so it is only visible with includeDeleted.
  const gone = await page.request.get(`/api/orders/${draftId}`);
  expect(gone.status()).toBe(404);
  const all = await api<{ items: { id: string; status: string }[] }>(page.request, 'GET', `/orders?includeDeleted=true&includeDraft=true&isWalkUp=true&pageSize=200`);
  expect(all.items.find((x) => x.id === draftId)?.status).toBe('Cancelled');
  expect(await onHand(page.request, plants.c.id)).toBe(beforeC);
});

test('walk-up line move to another plant', async ({ page }) => {
  // No page moves a line to another plant; the edit page sends qty/notes only.
  // Drive both API routes from the signed-in browser session, then render it.
  await login(page);
  const order = await api<{ id: string }>(page.request, 'POST', '/walkup/orders', { displayName: `E2E Walkup ${RUN}` });
  const line = await api<{ id: string }>(page.request, 'POST', `/walkup/orders/${order.id}/lines`, { plantCatalogId: plants.a.id, qtyOrdered: 1 });

  const moved = await api<{ plantCatalogId: string; plantName: string }>(page.request, 'PUT', `/walkup/orders/${order.id}/lines/${line.id}`, { plantCatalogId: plants.c.id, qtyOrdered: 1 });
  expect(moved.plantCatalogId).toBe(plants.c.id);
  expect(moved.plantName).toBe(plants.c.name);

  const back = await api<{ plantCatalogId: string; plantName: string }>(page.request, 'PUT', `/orders/${order.id}/lines/${line.id}`, { plantCatalogId: plants.a.id });
  expect(back.plantCatalogId).toBe(plants.a.id);
  expect(back.plantName).toBe(plants.a.name);

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText(plants.a.name).first()).toBeVisible();
  await shot(page, '12-line-moved');
});
