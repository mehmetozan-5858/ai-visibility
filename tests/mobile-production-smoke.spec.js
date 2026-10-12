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

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${route} horizontally overflows: ${overflow.scrollWidth}px > ${overflow.clientWidth}px`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 2);

    await page.waitForTimeout(500);
    expect(consoleErrors, `${route} emitted browser console errors`).toEqual([]);
  });
}
