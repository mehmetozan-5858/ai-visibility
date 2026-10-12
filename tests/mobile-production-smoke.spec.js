import { test, expect, devices } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL || 'https://www.aivisibilityworks.com';
const routes = ['/', '/musteri-giris', '/yeni-musteri', '/hizmetler', '/demo'];
const iphone = devices['iPhone 13'];

test.use({
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
  userAgent: iphone.userAgent,
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

for (const route of routes) {
  test(`mobile smoke ${route}`, async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    expect(response, `missing main document response for ${route}`).not.toBeNull();
    expect(response.status(), `${route} returned HTTP ${response.status()}`).toBeLessThan(400);

    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title.trim().length, `${route} has an empty title`).toBeGreaterThan(0);

    const overflow = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            className: typeof el.className === 'string' ? el.className : '',
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
          };
        })
        .filter((x) => x.right > clientWidth + 2 || x.left < -2)
        .slice(0, 20);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth, offenders };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 2) {
      console.log(`OVERFLOW ${route}: ${JSON.stringify(overflow.offenders)}`);
    }
    expect(
      overflow.scrollWidth,
      `${route} horizontally overflows: ${overflow.scrollWidth}px > ${overflow.clientWidth}px; offenders=${JSON.stringify(overflow.offenders)}`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 2);

    await page.waitForTimeout(500);
    expect(consoleErrors, `${route} emitted browser console errors`).toEqual([]);
  });
}
