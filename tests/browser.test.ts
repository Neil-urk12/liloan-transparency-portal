import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let browser: Browser;
let origin: string;
const envelope = (data: unknown) => ({ meta: { built_at: '2026-11-02', notice: 'Test fixture' }, disclaimers: [], data });
const row = {
  id: 'test', dataset: 'dpwh', title: 'Road in Liloan, Cebu', bridge_group: 'unchanged',
  status_label: 'Unchanged', group_label: 'Unchanged', held: false,
  nep_php: 5000000, house_php: 5000000, delta_php: 0, region_key: 'VII',
  office: null, pdf_url: {}, labels: { status: {}, flags: [] },
  url: 'https://api.example/project', api_url: '/datasets/dpwh/projects/test',
};

before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function fixture(page: Page, { total = 2, failProject = false } = {}) {
  let projectRequests = 0;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown;
    if (url.pathname.endsWith('/projects/test')) {
      projectRequests++;
      if (failProject && projectRequests === 1) {
        await route.fulfill({ status: 503, json: { error: { message: 'Temporary project failure' } } });
        return;
      }
      data = row;
    } else if (url.pathname.endsWith('/projects')) {
      const dpwh = url.pathname.includes('/dpwh/');
      const offset = Number(url.searchParams.get('offset'));
      data = { total: dpwh ? total : 0, rows: dpwh ? Array.from({ length: Math.min(200, total - offset) }, (_, i) => ({ ...row, id: String(offset + i) })) : [] };
    } else if (url.pathname.includes('/districts/')) {
      data = { id: 'leg:cebu:5th', label: 'Cebu 5th', offices: [], attribution: { label: 'Test fixture' } };
    } else if (url.pathname.includes('/gaa/')) {
      data = [];
    } else {
      data = { datasets: [], record_versions: [], terms: {}, documents: [] };
    }
    await route.fulfill({ json: envelope(data) });
  });
  return { projectRequests: () => projectRequests };
}

for (const sort of ['toString', 'constructor', '__proto__', 'unknown']) {
  test(`shared sort=${sort} falls back to house order`, async () => {
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await fixture(page);
      await page.goto(`${origin}?sort=${sort}`);
      await page.getByRole('heading', { name: 'Every project (2)', exact: true }).waitFor({ timeout: 5000 });
      assert.equal(await page.getByLabel('Sort by').inputValue(), 'house');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

for (const path of ['/#%', '/gaa#%']) {
  test(`malformed fragment ${path} leaves the page usable`, async () => {
    const page = await browser.newPage();
    try {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await fixture(page);
      await page.goto(new URL(path, origin).href);
      const heading = path.startsWith('/gaa') ? 'Reading these figures' : 'Every project (2)';
      await page.getByRole('heading', { name: heading, exact: true }).waitFor({ timeout: 5000 });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}

test('a project limit error hides complete totals and CSV downloads', async () => {
  const page = await browser.newPage();
  try {
    await fixture(page, { total: 4001 });
    await page.goto(origin);
    await page.getByRole('alert').filter({ hasText: /4,001.*4,000/ }).waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole('heading', { name: /Every project/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /Download CSV/ }).count(), 0);
    assert.equal(await page.locator('dl.stats').count(), 0);
  } finally { await page.close(); }
});

test('retry refetches a failed project and renders its detail', async () => {
  const page = await browser.newPage();
  try {
    const requests = await fixture(page, { failProject: true });
    await page.goto(new URL('/projects/dpwh/test', origin).href);
    await page.getByRole('alert').filter({ hasText: 'Temporary project failure' }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('heading', { name: row.title, exact: true }).waitFor({ timeout: 5000 });
    assert.equal(requests.projectRequests(), 2);
  } finally { await page.close(); }
});
