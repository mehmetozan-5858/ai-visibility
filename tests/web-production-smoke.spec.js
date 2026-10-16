import { test, expect } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL || 'https://www.aivisibilityworks.com';
const publicRoutes = [
  '/',
  '/hizmetler',
  '/demo',
  '/metodoloji',
  '/yapay-zeka-gorunurlugu',
  '/hakkimizda',
  '/iletisim',
  '/gizlilik',
  '/kvkk',
  '/iptal-iade',
  '/mesafeli-hizmet-sozlesmesi',
];

for (const route of publicRoutes) {
  test(`desktop public smoke ${route}`, async ({ page }) => {
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    expect(response, `missing main document response for ${route}`).not.toBeNull();
    expect(response.status(), `${route} returned HTTP ${response.status()}`).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
    expect((await page.title()).trim().length, `${route} has an empty title`).toBeGreaterThan(0);

    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    if (robots) expect(robots.toLowerCase(), `${route} unexpectedly blocks indexing`).not.toContain('noindex');

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical, `${route} is missing canonical metadata`).toBeTruthy();
    expect(canonical, `${route} canonical points outside production domain`).toContain('aivisibilityworks.com');

    await page.waitForTimeout(300);
    expect(consoleErrors, `${route} emitted browser console errors`).toEqual([]);
  });
}

test('homepage exposes critical discovery and conversion links', async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  for (const href of ['/hizmetler','/demo','/metodoloji','/yapay-zeka-gorunurlugu','/hakkimizda','/iletisim','/yeni-musteri','/musteri-giris']) {
    await expect(page.locator(`a[href="${href}"]`).first(), `missing homepage link ${href}`).toBeVisible();
  }
});

test('pricing package CTAs preserve service and country context', async ({ page }) => {
  await page.goto(`${BASE}/hizmetler?country=Germany`, { waitUntil: 'networkidle' });
  const hrefs = await page.locator('a[href^="/yeni-musteri?service="]').evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  expect(hrefs.some(href => href.includes('service=business-diagnosis') && href.includes('country=Germany'))).toBeTruthy();
  expect(hrefs.some(href => href.includes('service=business-solution') && href.includes('country=Germany'))).toBeTruthy();
  expect(hrefs.some(href => href.includes('service=business-monitoring') && href.includes('country=Germany'))).toBeTruthy();
});

test('private customer and admin surfaces remain noindex', async ({ page }) => {
  for (const route of ['/musteri-giris', '/musteri-sifre-sifirla']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    const robots = (await page.locator('meta[name="robots"]').getAttribute('content') || '').toLowerCase();
    expect(robots, `${route} must remain noindex`).toContain('noindex');
  }
});
