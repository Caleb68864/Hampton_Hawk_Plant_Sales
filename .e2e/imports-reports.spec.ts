/**
 * Imports and report read-back: uploads plants, inventory and orders through
 * the Imports page (a bad row in each file), checks the history tab and its
 * issue list, sells some of it (a pickup scan and a cash register sale), and
 * reads the numbers back from the reports, in the API and on the pages.
 *
 * The browser runs in America/Chicago so the report date handling is checked
 * in a US timezone whatever the machine's zone is (CI runs in UTC). Daily
 * Sales must list today's local date with today's sales in it: it used to drop
 * them (exclusive UTC-midnight end date) and label rows a day early.
 *
 * Same stack, env and credentials as sale-day.spec.ts (see its header). One
 * login. Report totals are global, so they are compared as before/after deltas
 * or by this run's own plants, customer and seller.
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set (see the header of sale-day.spec.ts).`);
  return value;
}

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' });

const RUN = Date.now().toString().slice(-6);
const letters = (s: string) => s.replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)]);
const SKU_A = `IMPA${RUN}`;
const SKU_B = `IMPB${RUN}`;
const NAME_A = `Import Rose ${letters(RUN)}`;
const NAME_B = `Tomato, Cherry ${letters(RUN)}`; // quoted in the CSV: the comma must not shift columns
const BARCODE_A = `7${RUN}10000`;
const BARCODE_B = `7${RUN}20000`;
const PRICE_A = 12.99;
const PRICE_B = 4.5;
const CUSTOMER = `Import Buyer ${letters(RUN)}`;
const SELLER = `Import Seller ${letters(RUN)}`;

const PLANTS_CSV = [
  'SKU,Name,Variant,Price,Barcode',
  `${SKU_A},${NAME_A},Red,${PRICE_A},${BARCODE_A}`,
  `${SKU_B},"${NAME_B}",,$${PRICE_B.toFixed(2)},${BARCODE_B}`,
  `IMPBAD${RUN},Bad Price Plant,,not-a-price,7${RUN}30000`,
].join('\n');
const INVENTORY_CSV = ['Sku,OnHandQty', `${SKU_A},20`, `${SKU_B},10`].join('\n');
const ORDERS_CSV = [
  'CustomerDisplayName,SellerDisplayName,PlantSKU,Qty,Notes',
  `${CUSTOMER},${SELLER},${SKU_A},2,e2e import`,
  `${CUSTOMER},${SELLER},${SKU_B},3,`,
].join('\n');

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const cents = (n: number) => Math.round(n * 100);

async function api<T>(req: APIRequestContext, method: string, url: string, data?: unknown): Promise<T> {
  const res = await req.fetch(`/api${url}`, { method, data });
  const body = await res.json().catch(() => null);
  expect(res.status(), `${method} ${url}: ${JSON.stringify(body)}`).toBe(200);
  return body.data as T;
}

function section(page: Page, title: string) {
  return page.getByRole('heading', { name: title }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
}

async function upload(page: Page, title: string, filename: string, csv: string) {
  const box = section(page, title);
  await box.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await box.getByRole('button', { name: 'Upload' }).click();
  await expect(box.getByText('Total Rows')).toBeVisible({ timeout: 15_000 });
  return box;
}

async function summary(box: ReturnType<typeof section>) {
  const read = async (label: string) => Number(await box.getByText(label, { exact: true }).locator('xpath=preceding-sibling::p[1]').innerText());
  return { total: await read('Total Rows'), imported: await read('Imported'), skipped: await read('Skipped') };
}

interface PlantRow { plantCatalogId: string; plantName: string; itemsOrdered: number; itemsFulfilled: number; revenueOrdered: number; revenueFulfilled: number }
interface PaymentRow { method: string; orderCount: number; revenue: number }

test('import plants, inventory and orders, then read the sales back from the reports', async ({ page }) => {
  test.setTimeout(180_000);
  const req = page.request;

  await page.goto('/login');
  await page.locator('#username').fill(required('E2E_ADMIN_USER'));
  await page.locator('#password').fill(required('E2E_ADMIN_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);

  const paymentsBefore = await api<{ methods: PaymentRow[] }>(req, 'GET', '/reports/payment-breakdown');
  const cashBefore = paymentsBefore.methods.find((m) => m.method === 'Cash') ?? { orderCount: 0, revenue: 0 };

  // --- Imports, through the page ---
  await page.goto('/imports');
  const plantsBox = await upload(page, 'Import Plants', `plants-${RUN}.csv`, PLANTS_CSV);
  expect(await summary(plantsBox)).toEqual({ total: 3, imported: 2, skipped: 1 });
  await expect(plantsBox.getByText(/not-a-price/)).toBeVisible();

  const inventoryBox = await upload(page, 'Import Inventory', `inventory-${RUN}.csv`, INVENTORY_CSV);
  expect(await summary(inventoryBox)).toMatchObject({ total: 2, skipped: 0 });

  const ordersBox = await upload(page, 'Import Orders', `orders-${RUN}.csv`, ORDERS_CSV);
  expect((await summary(ordersBox)).skipped).toBe(0);

  // What the imports wrote.
  const plants = await api<{ items: { id: string; sku: string; name: string; price: number; barcode: string }[] }>(
    req, 'GET', `/plants?search=${RUN}&pageSize=50`);
  const a = plants.items.find((p) => p.sku === SKU_A)!;
  const b = plants.items.find((p) => p.sku === SKU_B)!;
  expect(a).toMatchObject({ name: NAME_A, price: PRICE_A, barcode: BARCODE_A });
  expect(b).toMatchObject({ name: NAME_B, price: PRICE_B, barcode: BARCODE_B });
  expect(plants.items.some((p) => p.sku === `IMPBAD${RUN}`)).toBe(false);

  const inventory = await api<{ items: { plantCatalogId: string; onHandQty: number }[] }>(req, 'GET', '/inventory?pageSize=500');
  const onHand = (id: string) => inventory.items.find((r) => r.plantCatalogId === id)?.onHandQty;
  expect(onHand(a.id)).toBe(20);
  expect(onHand(b.id)).toBe(10);

  const orders = await api<{ items: { id: string }[] }>(req, 'GET', `/orders?search=${encodeURIComponent(CUSTOMER)}&pageSize=50`);
  expect(orders.items).toHaveLength(1); // one customer's rows group into one order
  const orderId = orders.items[0].id;
  const order = await api<{ seller: { displayName: string } | null; lines: { plantCatalogId: string; qtyOrdered: number }[] }>(req, 'GET', `/orders/${orderId}`);
  expect(order.seller?.displayName).toBe(SELLER);
  expect(order.lines.map((l) => [l.plantCatalogId, l.qtyOrdered]).sort()).toEqual([[a.id, 2], [b.id, 3]].sort());

  // --- Import history tab and its issue list ---
  await page.getByRole('button', { name: 'Import History' }).click();
  for (const file of [`plants-${RUN}.csv`, `inventory-${RUN}.csv`, `orders-${RUN}.csv`]) {
    await expect(page.getByRole('cell', { name: file })).toBeVisible();
  }
  await page.getByRole('row', { name: new RegExp(`plants-${RUN}`) }).getByRole('button', { name: 'View Issues' }).click();
  await expect(page.getByText(/not-a-price/)).toBeVisible();

  // --- Sell some of it ---
  await api(req, 'POST', `/orders/${orderId}/scan`, { barcode: BARCODE_A, quantity: 2, scanId: `imp-${RUN}-a` });
  const draft = await api<{ id: string }>(req, 'POST', '/walkup-register/draft', { workstationName: 'e2e-imports' });
  await api(req, 'POST', `/walkup-register/draft/${draft.id}/scan`, { plantBarcode: BARCODE_B, scanId: `imp-${RUN}-b`, quantity: 1 });
  await api(req, 'POST', `/walkup-register/draft/${draft.id}/close`, { paymentMethod: 'Cash', amountTendered: 5 });

  // --- Reports, from the API ---
  const byPlant = await api<PlantRow[]>(req, 'GET', '/reports/sales-by-plant');
  const rowA = byPlant.find((r) => r.plantCatalogId === a.id)!;
  const rowB = byPlant.find((r) => r.plantCatalogId === b.id)!;
  expect(rowA).toMatchObject({ itemsOrdered: 2, itemsFulfilled: 2 });
  expect(cents(rowA.revenueOrdered)).toBe(cents(2 * PRICE_A));
  expect(cents(rowA.revenueFulfilled)).toBe(cents(2 * PRICE_A));
  expect(rowB).toMatchObject({ itemsOrdered: 4, itemsFulfilled: 1 }); // 3 preordered + 1 at the register
  expect(cents(rowB.revenueOrdered)).toBe(cents(4 * PRICE_B));

  const byCustomer = await api<{ customerDisplayName: string; orderCount: number; itemsOrdered: number; revenueOrdered: number }[]>(
    req, 'GET', '/reports/sales-by-customer');
  const cust = byCustomer.find((r) => r.customerDisplayName === CUSTOMER)!;
  expect(cust).toMatchObject({ orderCount: 1, itemsOrdered: 5 });
  expect(cents(cust.revenueOrdered)).toBe(cents(2 * PRICE_A + 3 * PRICE_B));

  const bySeller = await api<{ sellerDisplayName: string; orderCount: number; itemsFulfilled: number }[]>(
    req, 'GET', '/reports/sales-by-seller');
  expect(bySeller.find((r) => r.sellerDisplayName === SELLER)).toMatchObject({ orderCount: 1, itemsFulfilled: 2 });

  const paymentsAfter = await api<{ methods: PaymentRow[] }>(req, 'GET', '/reports/payment-breakdown');
  const cashAfter = paymentsAfter.methods.find((m) => m.method === 'Cash')!;
  expect(cashAfter.orderCount - cashBefore.orderCount).toBe(1);
  expect(cents(cashAfter.revenue) - cents(cashBefore.revenue)).toBe(cents(PRICE_B));

  // --- Reports, on the pages ---
  await page.goto('/reports/sales-by-plant');
  const pageRowA = page.getByRole('row', { name: new RegExp(NAME_A) });
  await expect(pageRowA).toContainText(money(2 * PRICE_A));
  await expect(page.getByRole('row', { name: new RegExp(NAME_B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toContainText(money(4 * PRICE_B));

  // Daily Sales' default range ends today: today's local date must be listed.
  await page.goto('/reports/daily-sales');
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  await expect(page.getByRole('row', { name: new RegExp(today) })).toBeVisible({ timeout: 15_000 });
  const daily = await page.evaluate(async () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`/api/reports/daily-sales?from=${start.toISOString()}&to=${end.toISOString()}&timeZone=${tz}`, { credentials: 'include' });
    const body = await res.json();
    return { ymd, days: body.data.days as { date: string; orderCount: number }[] };
  });
  expect(daily.days.map((d) => d.date)).toEqual([daily.ymd]);
  expect(daily.days[0].orderCount).toBeGreaterThanOrEqual(2); // this run's preorder and register sale

  await page.goto('/reports/payment-breakdown');
  await expect(page.getByRole('row', { name: /Cash/ })).toContainText(money(cashAfter.revenue));
});
